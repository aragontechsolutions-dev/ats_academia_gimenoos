import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanalInvitacion, EstadoInvitacion, RolUsuario, type Invitacion } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { SupabaseAdminService } from '../../common/supabase/supabase-admin.service';
import { exigirEmail, normalizarEmail } from '../../common/formato/email';
import type { CrearInvitacionDto, ListarInvitacionesDto } from './dto/invitacion.dto';

/**
 * Lo que se devuelve al entregar un acceso.
 *
 * `enlace` viene SOLO cuando el canal es ENLACE, y viaja una única vez: es una
 * credencial, así que no se guarda ni se puede volver a pedir la misma.
 */
export type InvitacionEntregada = Invitacion & { enlace?: string };

@Injectable()
export class InvitacionesService {
  private readonly logger = new Logger(InvitacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly supabase: SupabaseAdminService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Invita a alguien a usar el sistema.
   *
   * El orden importa: primero se guarda la invitación y después se le pide a
   * Supabase que mande el correo. Si se hiciera al revés y fallara el guardado,
   * la persona recibiría un enlace que la API va a rechazar, y no habría forma
   * de darse cuenta desde el panel.
   *
   * Si falla el correo, la invitación queda guardada con `enviadaAt` en null:
   * el panel la muestra como «sin enviar» y se puede reintentar sin duplicarla.
   */
  async crear(dto: CrearInvitacionDto, usuarioId: string) {
    const { email, clienteId, instructorId } = await this.resolverDestino(dto);

    await this.comprobarQueNoTengaCuenta(email);

    const pendiente = await this.prisma.invitacion.findFirst({
      where: { email, estado: EstadoInvitacion.PENDIENTE },
    });

    // Reinvitar a alguien que ya tiene una pendiente no crea otra: reenvía la
    // misma. Dos filas pendientes para el mismo correo dejarían el vínculo sin
    // decidir, que es justo lo que esta tabla viene a evitar.
    const invitacion =
      pendiente ??
      (await this.prisma.invitacion.create({
        data: { email, rol: dto.rol, clienteId, instructorId, invitadaPor: usuarioId },
      }));

    if (pendiente) {
      this.logger.log(`Reenvío de la invitación ${pendiente.id}`);
    }

    return this.entregar(invitacion, dto.canal ?? CanalInvitacion.CORREO, usuarioId);
  }

  /** Vuelve a entregar el acceso de una invitación que ya existe. */
  async reenviar(id: string, canal: CanalInvitacion, usuarioId: string) {
    const invitacion = await this.prisma.invitacion.findUnique({ where: { id } });
    if (!invitacion) throw new NotFoundException('La invitación no existe');
    if (invitacion.estado !== EstadoInvitacion.PENDIENTE) {
      throw new ConflictException('Esa invitación ya no está pendiente');
    }
    return this.entregar(invitacion, canal, usuarioId);
  }

  /**
   * Da de baja una invitación que todavía no se usó.
   *
   * No borra la fila: queda como historial de que se invitó y se dio marcha
   * atrás, que es parte de poder responder «quién habilitó a esta persona».
   */
  async revocar(id: string, usuarioId: string) {
    const invitacion = await this.prisma.invitacion.findUnique({ where: { id } });
    if (!invitacion) throw new NotFoundException('La invitación no existe');
    if (invitacion.estado === EstadoInvitacion.ACEPTADA) {
      throw new ConflictException(
        'Esa invitación ya se usó. Para sacarle el acceso hay que desactivar la cuenta.',
      );
    }

    const revocada = await this.prisma.invitacion.update({
      where: { id },
      data: { estado: EstadoInvitacion.REVOCADA },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'INVITACION_REVOCADA',
      entidad: 'Invitacion',
      entidadId: id,
      detalle: { rol: revocada.rol },
    });
    return revocada;
  }

  /**
   * Invitaciones, filtrables.
   *
   * Sin filtros devuelve todas: es lo que usa la pantalla de cuentas para
   * mostrar a quién se invitó y todavía no entró. Con `clienteId`, las de una
   * ficha, que es lo que muestra la ficha del alumno.
   */
  listar(filtros: ListarInvitacionesDto) {
    return this.prisma.invitacion.findMany({
      where: {
        ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
        ...(filtros.instructorId ? { instructorId: filtros.instructorId } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true } },
        instructor: { select: { id: true, nombre: true, apellido: true } },
      },
    });
  }

  // --- Interno --------------------------------------------------------------

  /**
   * Hace llegar el acceso, por el canal que corresponda.
   *
   * Con `CORREO` lo manda Supabase. Con `ENLACE` se genera el enlace y se
   * devuelve una sola vez, para que la academia lo pegue donde ya está hablando
   * con esa persona —típicamente WhatsApp—.
   *
   * El enlace **no se guarda ni se registra**: es una credencial, y quien la
   * tenga entra como esa persona. Lo único que queda es que se entregó y por
   * dónde.
   */
  private async entregar(
    invitacion: Invitacion,
    canal: CanalInvitacion,
    usuarioId: string,
  ): Promise<InvitacionEntregada> {
    const destino = this.destinoDe(invitacion.rol);

    let enlace: string | undefined;
    if (canal === CanalInvitacion.CORREO) {
      await this.supabase.invitar(invitacion.email, destino);
    } else {
      // Primer acceso salvo que la cuenta ya exista en Supabase de un intento
      // anterior: `invite` falla si ya está creada, `magiclink` sirve igual.
      const codigo = await this.generarCodigoTolerante(invitacion.email, destino);
      enlace = this.armarEnlace(destino, codigo);
    }

    const entregada = await this.prisma.invitacion.update({
      where: { id: invitacion.id },
      data: { enviadaAt: new Date(), canal },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'INVITACION_ENVIADA',
      entidad: 'Invitacion',
      entidadId: invitacion.id,
      // Ni el correo ni el enlace van al registro: uno es un dato personal y el
      // otro una credencial. El id ya identifica la fila para investigar.
      detalle: { rol: invitacion.rol, canal },
    });

    return enlace ? { ...entregada, enlace } : entregada;
  }

  /**
   * Pide el código como primer acceso y, si la cuenta ya existía, como acceso
   * normal.
   *
   * Pasa cuando se invitó por correo y después se quiere mandar el enlace por
   * WhatsApp: la cuenta de Supabase ya quedó creada por el intento anterior, y
   * `invite` la rechaza por duplicada.
   */
  private async generarCodigoTolerante(email: string, destino: string) {
    try {
      return await this.supabase.generarCodigo(email, destino, true);
    } catch {
      return this.supabase.generarCodigo(email, destino, false);
    }
  }

  /**
   * Arma el enlace que se le manda a la persona.
   *
   * Apunta a una pantalla NUESTRA, no a la dirección de verificación que arma
   * Supabase, y eso es todo el punto: esa dirección se consume con una sola
   * visita, y WhatsApp visita los enlaces para armar la vista previa. El enlace
   * llegaba quemado y la persona veía «el enlace es inválido o expiró».
   *
   * Nuestra pantalla canjea el código desde JavaScript, que los rastreadores de
   * vista previa no ejecutan. De paso, el enlace se ve como de la academia y no
   * depende de la lista de direcciones permitidas de Supabase.
   */
  private armarEnlace(destino: string, codigo: { tokenHash: string; tipo: string }): string {
    const url = new URL('/entrar', destino);
    url.searchParams.set('token_hash', codigo.tokenHash);
    url.searchParams.set('type', codigo.tipo);
    return url.toString();
  }

  /**
   * A dónde cae la persona al tocar el enlace del correo.
   *
   * Un alumno va a su app; un instructor o un administrador, al panel. Mandar a
   * todos al mismo lado dejaría al alumno en una pantalla que no puede usar.
   */
  private destinoDe(rol: RolUsuario): string {
    const variable = rol === RolUsuario.CLIENTE ? 'APP_ALUMNO_URL' : 'APP_PANEL_URL';
    const porDefecto = rol === RolUsuario.CLIENTE
      ? 'http://localhost:5175'
      : 'http://localhost:5174';
    const destino = this.config.get<string>(variable) ?? porDefecto;

    // En producción, un destino local significa que la variable quedó sin
    // cargar. Sin este corte la invitación sale igual y la persona recibe un
    // enlace que la lleva a su propia computadora: falla en silencio y del lado
    // de quien menos puede entender por qué.
    //
    // Ojo: aunque esté bien cargada, Supabase igual descarta el destino si no
    // está en su lista de URLs permitidas, y en su lugar manda al Site URL del
    // proyecto. Ver docs/18-cuentas-e-invitaciones.md.
    if (
      this.config.get<string>('NODE_ENV') === 'production' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(destino)
    ) {
      this.logger.error(`${variable} apunta a ${destino} en producción`);
      throw new ServiceUnavailableException(
        `Falta configurar ${variable} en el servidor: apunta a una dirección local, ` +
          'así que el enlace no llevaría a ninguna parte.',
      );
    }

    return destino;
  }

  /**
   * Decide correo y ficha, y comprueba que el pedido tenga sentido.
   *
   * Las mismas reglas las hace cumplir la base con CHECKs. Acá se repiten para
   * poder responder con un mensaje entendible en vez de un error de constraint.
   */
  private async resolverDestino(dto: CrearInvitacionDto) {
    if (dto.clienteId && dto.instructorId) {
      throw new BadRequestException('Una invitación pertenece a una sola ficha');
    }

    if (dto.rol === RolUsuario.CLIENTE) {
      if (!dto.clienteId) throw new BadRequestException('Falta el alumno al que invitar');
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: dto.clienteId },
        select: { id: true, email: true, activo: true, usuarioId: true },
      });
      if (!cliente) throw new NotFoundException('El alumno no existe');
      if (!cliente.activo) throw new ConflictException('El alumno está dado de baja');
      if (cliente.usuarioId) {
        throw new ConflictException('Ese alumno ya tiene cuenta en el sistema');
      }
      return {
        email: exigirEmail(
          dto.email ?? cliente.email,
          'Ese alumno no tiene correo cargado. Completalo en su ficha o escribilo acá.',
        ),
        clienteId: cliente.id,
        instructorId: null,
      };
    }

    if (dto.rol === RolUsuario.INSTRUCTOR) {
      if (!dto.instructorId) throw new BadRequestException('Falta el instructor al que invitar');
      const instructor = await this.prisma.instructor.findUnique({
        where: { id: dto.instructorId },
        select: { id: true, activo: true, usuarioId: true },
      });
      if (!instructor) throw new NotFoundException('El instructor no existe');
      if (!instructor.activo) throw new ConflictException('El instructor está dado de baja');
      if (instructor.usuarioId) {
        throw new ConflictException('Ese instructor ya tiene cuenta en el sistema');
      }
      return {
        email: exigirEmail(dto.email, 'Falta el correo al que mandar la invitación'),
        clienteId: null,
        instructorId: instructor.id,
      };
    }

    // ADMIN: no va atado a ninguna ficha.
    if (dto.clienteId || dto.instructorId) {
      throw new BadRequestException('Una invitación de administrador no lleva ficha');
    }
    return {
      email: exigirEmail(dto.email, 'Falta el correo al que mandar la invitación'),
      clienteId: null,
      instructorId: null,
    };
  }

  private async comprobarQueNoTengaCuenta(email: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (usuario) {
      throw new ConflictException(
        'Esa dirección ya tiene cuenta en el sistema. No hace falta invitarla.',
      );
    }
  }
}
