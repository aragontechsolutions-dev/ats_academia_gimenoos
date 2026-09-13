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

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
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
      select: SELECCION_RESERVA,
      orderBy: { inicio: 'asc' },
    });
  }

  async obtener(id: string, usuario: UsuarioAutenticado) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id },
      select: { ...SELECCION_RESERVA, clienteId: true, instructorId: true },
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
