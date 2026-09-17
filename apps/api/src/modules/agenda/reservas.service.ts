import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoReserva,
  EstadoVehiculo,
  RolUsuario,
  TipoVehiculo,
  type Prisma,
} from '@prisma/client';
import { DateTime } from 'luxon';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';
import type { CrearReservaDto } from './dto/crear-reserva.dto';
import type { ListarReservasDto } from './dto/listar-reservas.dto';
import type { ReprogramarReservaDto } from './dto/reprogramar-reserva.dto';
import type { EstadoAsignable } from './dto/cambiar-estado-reserva.dto';
import { TelegramService } from '../../common/telegram/telegram.service';
import {
  avisoDeCancelacion,
  avisoDeCierre,
  avisoDeReservaNueva,
} from './avisos-de-agenda';

/**
 * Cuánto puede abarcar una consulta de agenda, en días, según quién consulta.
 *
 * El tope existe porque `desde` y `hasta` los elige quien consulta: sin él,
 * cualquier cuenta autenticada puede pedir diez años de reservas en una sola
 * llamada. Es la misma razón por la que los listados acotan `porPagina`.
 *
 * Pero el número no puede ser el mismo para todos, y esto se aprendió rompiendo
 * la app del alumno en producción: un tope único de 62 días dejó su pantalla de
 * «Mis clases» mostrando un error rojo, porque pide un año hacia atrás y tres
 * meses hacia adelante —unos 470 días— para armar su historial.
 *
 * Lo que cambia entre roles no es la confianza sino **cuánto trabajo puede
 * costar la consulta**:
 *
 * - `CLIENTE`: la consulta ya está acotada a sus propias reservas por
 *   `clienteId`, así que el rango casi no influye: un alumno tiene decenas de
 *   clases, no miles. Dos años cubren su historial completo con margen.
 * - `INSTRUCTOR`: acotada a su agenda. Su app no pide más que la grilla de un
 *   mes (42 casilleros contando los días de relleno), así que 62 sobra.
 * - `ADMIN`: es la única consulta **sin** acotar por persona, o sea la que de
 *   verdad puede recorrer la tabla entera. El panel tampoco pide más que la
 *   grilla de un mes.
 *
 * Si alguna de las tres apps necesita un período más largo, se sube el número de
 * ESE rol y se ajusta la prueba que fija cuánto pide cada una. No se sube el de
 * todos.
 */
const RANGO_MAXIMO_DIAS: Record<RolUsuario, number> = {
  [RolUsuario.CLIENTE]: 730,
  [RolUsuario.INSTRUCTOR]: 62,
  [RolUsuario.ADMIN]: 62,
};

/** Estados que siguen ocupando el horario. Coincide con las EXCLUDE constraints. */
const ESTADOS_QUE_OCUPAN: EstadoReserva[] = [EstadoReserva.PENDIENTE, EstadoReserva.CONFIRMADA];

/** Campos que se devuelven de una reserva. No se expone nada de la ficha interna del alumno. */
const SELECCION_RESERVA = {
  id: true,
  inicio: true,
  fin: true,
  estado: true,
  tipo: true,
  lugarEncuentro: true,
  observaciones: true,
  motivoCancelacion: true,
  createdAt: true,
  cliente: {
    select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
  },
  instructor: { select: { id: true, nombre: true, apellido: true, colorAgenda: true } },
  vehiculo: { select: { id: true, patente: true, tipo: true } },
} satisfies Prisma.ReservaSelect;

/**
 * Lo mismo, mas la nota que escribe el instructor sobre como fue la clase.
 *
 * Va aparte porque el alumno NO la recibe: son observaciones de desempeño para
 * la academia, no un mensaje para él. Que no le llegue no depende de que su
 * pantalla la oculte —eso sería confiar en el cliente—: directamente no se pide
 * a la base cuando quien consulta es un alumno.
 */
const SELECCION_CON_NOTA = {
  ...SELECCION_RESERVA,
  notaInstructor: true,
} satisfies Prisma.ReservaSelect;

/** Qué campos ve cada rol. Un alumno nunca recibe la nota del instructor. */
function camposPara(rol: RolUsuario) {
  return rol === RolUsuario.CLIENTE ? SELECCION_RESERVA : SELECCION_CON_NOTA;
}

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly telegram: TelegramService,
  ) {}

  // --------------------------------------------------------------------------
  // Consulta
  // --------------------------------------------------------------------------

  /**
   * Lista reservas dentro de un rango.
   *
   * El filtro por rol NO es opcional ni se delega al frontend: se aplica acá,
   * sobre la consulta. Un cliente que pida `clienteId` de otro recibe sus
   * propias reservas, no las ajenas.
   */
  async listar(dto: ListarReservasDto, usuario: UsuarioAutenticado) {
    const maximo = RANGO_MAXIMO_DIAS[usuario.rol];
    const dias = DateTime.fromJSDate(dto.hasta).diff(DateTime.fromJSDate(dto.desde), 'days').days;
    if (dias > maximo) {
      throw new BadRequestException(
        `El rango de la consulta no puede superar ${maximo} días. Pedí un período más corto.`,
      );
    }

    const filtro: Prisma.ReservaWhereInput = {
      inicio: { lt: dto.hasta },
      fin: { gt: dto.desde },
      ...(dto.estado ? { estado: dto.estado } : {}),
      ...(dto.vehiculoId ? { vehiculoId: dto.vehiculoId } : {}),
    };

    switch (usuario.rol) {
      case RolUsuario.ADMIN:
        if (dto.instructorId) filtro.instructorId = dto.instructorId;
        if (dto.clienteId) filtro.clienteId = dto.clienteId;
        break;

      case RolUsuario.INSTRUCTOR: {
        // Un instructor ve su propia agenda, sin importar qué filtro pida.
        const instructor = await this.instructorDe(usuario.id);
        filtro.instructorId = instructor.id;
        if (dto.clienteId) filtro.clienteId = dto.clienteId;
        break;
      }

      case RolUsuario.CLIENTE: {
        const cliente = await this.clienteDe(usuario.id);
        filtro.clienteId = cliente.id;
        break;
      }
    }

    return this.prisma.reserva.findMany({
      where: filtro,
      select: camposPara(usuario.rol),
      orderBy: { inicio: 'asc' },
    });
  }

  async obtener(id: string, usuario: UsuarioAutenticado) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id },
      select: { ...camposPara(usuario.rol), clienteId: true, instructorId: true },
    });
    if (!reserva) throw new NotFoundException('La reserva no existe');

    await this.verificarAcceso(reserva, usuario);
    return reserva;
  }

  // --------------------------------------------------------------------------
  // Alta
  // --------------------------------------------------------------------------

  async crear(dto: CrearReservaDto, usuario: UsuarioAutenticado, ahora: Date = new Date()) {
    const clienteId = await this.resolverClienteDestino(dto.clienteId, usuario);
    const fin = DateTime.fromJSDate(dto.inicio).plus({ minutes: dto.duracionMin }).toJSDate();

    const config = await this.configuracion();
    await this.validarRecursos(dto.instructorId, dto.vehiculoId, dto.tipo);
    this.validarAntelacion(dto.inicio, config.antelacionMinimaHoras, usuario, ahora);
    await this.validarCompra(dto.compraId, clienteId);

    const reserva = await this.prisma.reserva.create({
      data: {
        clienteId,
        instructorId: dto.instructorId,
        vehiculoId: dto.vehiculoId,
        compraId: dto.compraId ?? null,
        tipo: dto.tipo,
        inicio: dto.inicio,
        fin,
        // Quien agenda desde el panel confirma en el acto; el alumno queda pendiente.
        estado:
          usuario.rol === RolUsuario.CLIENTE ? EstadoReserva.PENDIENTE : EstadoReserva.CONFIRMADA,
        lugarEncuentro: dto.lugarEncuentro ?? null,
        observaciones: dto.observaciones ?? null,
      },
      select: SELECCION_RESERVA,
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'RESERVA_CREADA',
      entidad: 'Reserva',
      entidadId: reserva.id,
      detalle: { inicio: dto.inicio.toISOString(), instructorId: dto.instructorId },
    });

    // Sin `await`: la clase ya está guardada y devolverla no puede quedar
    // esperando a Telegram. `avisar` no falla hacia afuera.
    void this.telegram.avisar(
      'reservaNueva',
      avisoDeReservaNueva(reserva, usuario.rol === RolUsuario.CLIENTE),
    );

    return reserva;
  }

  // --------------------------------------------------------------------------
  // Modificación
  // --------------------------------------------------------------------------

  /**
   * Mueve la clase a otro horario, instructor o vehículo.
   *
   * Se actualiza la fila en lugar de cancelar y crear otra: la reserva conserva
   * su identificador (los enlaces que ya tiene el alumno siguen sirviendo) y la
   * EXCLUDE constraint protege igual, porque no compara una fila consigo misma.
   * El movimiento queda registrado en la auditoría.
   */
  async reprogramar(
    id: string,
    dto: ReprogramarReservaDto,
    usuario: UsuarioAutenticado,
    ahora: Date = new Date(),
  ) {
    const reserva = await this.prisma.reserva.findUnique({ where: { id } });
    if (!reserva) throw new NotFoundException('La reserva no existe');
    await this.verificarAcceso(reserva, usuario);

    if (!ESTADOS_QUE_OCUPAN.includes(reserva.estado)) {
      throw new BadRequestException(
        'Solo se pueden reprogramar clases pendientes o confirmadas',
      );
    }

    const config = await this.configuracion();
    this.validarAntelacion(dto.inicio, config.antelacionMinimaHoras, usuario, ahora);

    const instructorId = dto.instructorId ?? reserva.instructorId;
    const vehiculoId = dto.vehiculoId ?? reserva.vehiculoId;
    if (vehiculoId) await this.validarRecursos(instructorId, vehiculoId, reserva.tipo);

    const fin = DateTime.fromJSDate(dto.inicio).plus({ minutes: dto.duracionMin }).toJSDate();

    const actualizada = await this.prisma.reserva.update({
      where: { id },
      data: { inicio: dto.inicio, fin, instructorId, vehiculoId },
      select: SELECCION_RESERVA,
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'RESERVA_REPROGRAMADA',
      entidad: 'Reserva',
      entidadId: id,
      detalle: {
        desde: reserva.inicio.toISOString(),
        hacia: dto.inicio.toISOString(),
      },
    });

    return actualizada;
  }

  async cancelar(
    id: string,
    motivo: string | undefined,
    usuario: UsuarioAutenticado,
    ahora: Date = new Date(),
  ) {
    const reserva = await this.prisma.reserva.findUnique({ where: { id } });
    if (!reserva) throw new NotFoundException('La reserva no existe');
    await this.verificarAcceso(reserva, usuario);

    if (reserva.estado === EstadoReserva.CANCELADA) {
      throw new BadRequestException('La clase ya estaba cancelada');
    }
    if (!ESTADOS_QUE_OCUPAN.includes(reserva.estado)) {
      throw new BadRequestException('Solo se pueden cancelar clases pendientes o confirmadas');
    }

    // La política de antelación rige para el alumno. La academia puede cancelar
    // siempre: si el instructor se enferma, la clase no se puede dar igual.
    if (usuario.rol === RolUsuario.CLIENTE) {
      const config = await this.configuracion();
      const horasRestantes = DateTime.fromJSDate(reserva.inicio).diff(
        DateTime.fromJSDate(ahora),
        'hours',
      ).hours;

      if (horasRestantes < config.cancelacionMinimaHoras) {
        throw new BadRequestException(
          `Las clases se cancelan con al menos ${config.cancelacionMinimaHoras} horas de antelación. ` +
            'Comunicate con la academia.',
        );
      }
    }

    const cancelada = await this.prisma.reserva.update({
      where: { id },
      data: {
        estado: EstadoReserva.CANCELADA,
        canceladaAt: ahora,
        motivoCancelacion: motivo ?? null,
      },
      select: SELECCION_RESERVA,
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'RESERVA_CANCELADA',
      entidad: 'Reserva',
      entidadId: id,
      detalle: { inicio: reserva.inicio.toISOString() },
    });

    void this.telegram.avisar('claseCancelada', avisoDeCancelacion(cancelada, motivo ?? null));

    return cancelada;
  }

  /**
   * Marca la clase como confirmada, dictada o ausente. Solo la academia.
   *
   * Al completarla se descuenta la clase del pack, si la reserva estaba
   * asociada a una compra. Va en una transacción con el cambio de estado para
   * que no quede una clase dictada sin descontar, ni al revés.
   */
  async cambiarEstado(id: string, estado: EstadoAsignable, usuario: UsuarioAutenticado) {
    const reserva = await this.prisma.reserva.findUnique({ where: { id } });
    if (!reserva) throw new NotFoundException('La reserva no existe');
    await this.verificarAcceso(reserva, usuario);

    if (reserva.estado === EstadoReserva.CANCELADA) {
      throw new BadRequestException('Una clase cancelada no cambia de estado');
    }
    if (reserva.estado === estado) return this.obtener(id, usuario);

    const seConsumeClase =
      estado === EstadoReserva.COMPLETADA &&
      reserva.estado !== EstadoReserva.COMPLETADA &&
      reserva.compraId !== null;

    const actualizada = await this.prisma.$transaction(async (tx) => {
      if (seConsumeClase) {
        // El CHECK compra_clases_usadas_valido impide pasarse del total: si la
        // compra ya está agotada, esta escritura falla y no se completa la clase.
        await tx.compraServicio.update({
          where: { id: reserva.compraId! },
          data: { clasesUsadas: { increment: 1 } },
        });
      }
      return tx.reserva.update({ where: { id }, data: { estado }, select: SELECCION_RESERVA });
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'RESERVA_ESTADO_CAMBIADO',
      entidad: 'Reserva',
      entidadId: id,
      detalle: { de: reserva.estado, a: estado, consumioClase: seConsumeClase },
    });

    // Sólo los cierres avisan: pasar a CONFIRMADA es movimiento interno y quien
    // recibiría el aviso es justamente quien acaba de confirmarla.
    const cierre = avisoDeCierre(actualizada, estado);
    if (cierre) void this.telegram.avisar('claseCerrada', cierre);

    return actualizada;
  }

  /**
   * Guarda cómo fue la clase.
   *
   * La escribe el instructor que la dio, desde su app. El alumno NO la recibe:
   * la elección de campos según el rol está en `camposPara`, así que no depende
   * de que ninguna pantalla se acuerde de ocultarla.
   *
   * Ojo con quién puede llegar acá: `verificarAcceso` deja pasar a un alumno
   * sobre SU propia clase, así que lo único que impide que un alumno se escriba
   * su propia observación es el `@Roles` del controlador.
   */
  async guardarNota(id: string, nota: string | undefined, usuario: UsuarioAutenticado) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id },
      select: { clienteId: true, instructorId: true },
    });
    if (!reserva) throw new NotFoundException('La reserva no existe');
    await this.verificarAcceso(reserva, usuario);

    const limpia = nota?.trim() ?? '';
    const actualizada = await this.prisma.reserva.update({
      where: { id },
      data: { notaInstructor: limpia === '' ? null : limpia },
      select: camposPara(usuario.rol),
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'RESERVA_NOTA_GUARDADA',
      entidad: 'Reserva',
      entidadId: id,
      // El TEXTO no va al registro: es una observación sobre una persona, y la
      // auditoría responde "quién y cuándo", no guarda una segunda copia.
      detalle: { borrada: limpia === '' },
    });

    return actualizada;
  }

  // --------------------------------------------------------------------------
  // Reglas de acceso y validaciones
  // --------------------------------------------------------------------------

  /**
   * Quién puede tocar esta reserva.
   *
   * Es la defensa contra el fallo más común de estas APIs: cambiar el id de la
   * URL y operar sobre la clase de otra persona.
   */
  private async verificarAcceso(
    reserva: { clienteId: string; instructorId: string },
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    if (usuario.rol === RolUsuario.ADMIN) return;

    if (usuario.rol === RolUsuario.INSTRUCTOR) {
      const instructor = await this.instructorDe(usuario.id);
      if (instructor.id === reserva.instructorId) return;
      throw new ForbiddenException('Esta clase no es de tu agenda');
    }

    const cliente = await this.clienteDe(usuario.id);
    if (cliente.id === reserva.clienteId) return;
    // Mensaje deliberadamente igual al de "no existe" sería preferible, pero el
    // recurso ya se sabe existente por el 404 previo; lo que importa es no filtrar datos.
    throw new ForbiddenException('Esta clase no es tuya');
  }

  /** Un cliente solo agenda para sí mismo, diga lo que diga el cuerpo del request. */
  private async resolverClienteDestino(
    clienteIdPedido: string | undefined,
    usuario: UsuarioAutenticado,
  ): Promise<string> {
    if (usuario.rol === RolUsuario.CLIENTE) {
      const cliente = await this.clienteDe(usuario.id);
      return cliente.id;
    }

    if (!clienteIdPedido) {
      throw new BadRequestException('Indicá a qué alumno corresponde la clase');
    }

    const existe = await this.prisma.cliente.findUnique({
      where: { id: clienteIdPedido },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('El alumno indicado no existe');
    return existe.id;
  }

  private async validarRecursos(
    instructorId: string,
    vehiculoId: string,
    tipo: TipoVehiculo,
  ): Promise<void> {
    const [instructor, vehiculo] = await Promise.all([
      this.prisma.instructor.findUnique({
        where: { id: instructorId },
        select: { activo: true, habilitaMoto: true, habilitaAuto: true },
      }),
      this.prisma.vehiculo.findUnique({
        where: { id: vehiculoId },
        select: { tipo: true, estado: true },
      }),
    ]);

    if (!instructor) throw new NotFoundException('El instructor no existe');
    if (!instructor.activo) throw new BadRequestException('El instructor no está activo');

    const habilitado = tipo === TipoVehiculo.MOTO ? instructor.habilitaMoto : instructor.habilitaAuto;
    if (!habilitado) {
      throw new BadRequestException(
        `El instructor no está habilitado para dar clases de ${tipo.toLowerCase()}`,
      );
    }

    if (!vehiculo) throw new NotFoundException('El vehículo no existe');
    if (vehiculo.estado !== EstadoVehiculo.ACTIVO) {
      throw new BadRequestException('El vehículo no está disponible');
    }
    if (vehiculo.tipo !== tipo) {
      throw new BadRequestException('El vehículo no corresponde al tipo de clase');
    }
  }

  /** La antelación mínima rige para el alumno; la academia agenda cuando necesita. */
  private validarAntelacion(
    inicio: Date,
    antelacionMinimaHoras: number,
    usuario: UsuarioAutenticado,
    ahora: Date,
  ): void {
    if (usuario.rol !== RolUsuario.CLIENTE) {
      if (inicio <= ahora) {
        throw new BadRequestException('La clase no puede empezar en el pasado');
      }
      return;
    }

    const horas = DateTime.fromJSDate(inicio).diff(DateTime.fromJSDate(ahora), 'hours').hours;
    if (horas < antelacionMinimaHoras) {
      throw new BadRequestException(
        `Las clases se reservan con al menos ${antelacionMinimaHoras} horas de antelación`,
      );
    }
  }

  private async validarCompra(compraId: string | undefined, clienteId: string): Promise<void> {
    if (!compraId) return;

    const compra = await this.prisma.compraServicio.findUnique({
      where: { id: compraId },
      select: { clienteId: true, clasesTotales: true, clasesUsadas: true, vigenteHasta: true },
    });

    if (!compra) throw new NotFoundException('La compra indicada no existe');
    // Descontar clases de un pack ajeno sería robarle clases a otro alumno.
    if (compra.clienteId !== clienteId) {
      throw new ForbiddenException('Esa compra pertenece a otro alumno');
    }
    if (compra.clasesUsadas >= compra.clasesTotales) {
      throw new BadRequestException('Ese pack ya no tiene clases disponibles');
    }
    if (compra.vigenteHasta && compra.vigenteHasta < new Date()) {
      throw new BadRequestException('Ese pack está vencido');
    }
  }

  private async clienteDe(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!cliente) {
      throw new ForbiddenException(
        'Tu usuario todavía no tiene ficha de alumno. Comunicate con la academia.',
      );
    }
    return cliente;
  }

  private async instructorDe(usuarioId: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!instructor) {
      throw new ForbiddenException('Tu usuario no está asociado a ningún instructor');
    }
    return instructor;
  }

  private async configuracion() {
    const config = await this.prisma.configuracionAcademia.findUnique({ where: { id: 1 } });
    if (!config) {
      throw new BadRequestException('La configuración de la academia no está inicializada');
    }
    return config;
  }
}
