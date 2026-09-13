import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoInvitacion, RolUsuario, type Invitacion, type Usuario } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizarEmail } from '../../common/formato/email';
import type { SupabaseJwtPayload, UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Resuelve el usuario local a partir de un JWT ya verificado.
   *
   * Un token válido de Supabase NO alcanza para entrar. Hace falta, además, una
   * invitación vigente emitida desde el panel.
   *
   * Antes bastaba con el token: la cuenta se creaba sola con rol CLIENTE y la
   * ficha de alumno se adivinaba por correo. Eso significaba que cualquier
   * persona que escribiera su dirección en la app entraba y se llevaba una ficha
   * de alumno vacía dentro del listado de la academia. El alta del navegador ya
   * está cerrada (`shouldCreateUser: false`), pero eso es una comprobación del
   * lado del cliente: la que cuenta es esta.
   *
   * Si el usuario ya existe, manda el rol de la base: un token viejo nunca puede
   * devolverle privilegios a alguien a quien se le cambió el rol.
   */
  async resolverDesdeToken(payload: SupabaseJwtPayload): Promise<UsuarioAutenticado> {
    const existente = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });

    if (existente) {
      if (!existente.activo) throw new ForbiddenException('La cuenta esta deshabilitada');
      return { id: existente.id, email: existente.email, rol: existente.rol };
    }

    const usuario = await this.aprovisionar(payload);
    return { id: usuario.id, email: usuario.email, rol: usuario.rol };
  }

  /** Primer acceso: la cuenta local todavía no existe. */
  private async aprovisionar(payload: SupabaseJwtPayload): Promise<Usuario> {
    const email = normalizarEmail(payload.email);
    if (!email) {
      throw new ForbiddenException('La cuenta no tiene un correo con el que identificarla');
    }

    // Una cuenta de Supabase distinta con un correo que ya está en uso acá. Pasa
    // al rehacer el proyecto de Supabase: los identificadores cambian y la fila
    // vieja queda apuntando a una cuenta que ya no existe. Se avisa en vez de
    // fallar con un error de clave duplicada, que no le diría nada a nadie.
    const mismoEmail = await this.prisma.usuario.findUnique({ where: { email } });
    if (mismoEmail) {
      this.logger.error(
        `El usuario ${payload.sub} trae el correo de la cuenta ${mismoEmail.id}, que ya existe. ` +
          'Si se rehizo el proyecto de Supabase, hay que actualizar el id de esa fila. ' +
          'Ver docs/18-cuentas-e-invitaciones.md.',
      );
      throw new ForbiddenException(
        'Ya hay una cuenta con ese correo registrada con otro identificador. Avisale a la academia.',
      );
    }

    const invitacion = await this.prisma.invitacion.findFirst({
      where: { email, estado: EstadoInvitacion.PENDIENTE },
      include: { cliente: true, instructor: true },
    });

    if (invitacion) return this.crearDesdeInvitacion(payload.sub, email, invitacion);

    const administradorInicial = normalizarEmail(this.config.get<string>('ADMIN_INICIAL_EMAIL'));
    if (administradorInicial && administradorInicial === email) {
      return this.crearAdministradorInicial(payload.sub, email);
    }

    this.logger.warn(`Ingreso rechazado: ${payload.sub} no tiene invitación vigente`);
    throw new ForbiddenException(
      'Esta cuenta no está habilitada. Pedile a la academia que te invite a usar el sistema.',
    );
  }

  /**
   * Crea la cuenta y la ata a su ficha, todo junto.
   *
   * En una sola transacción porque las tres cosas son una: si se creara el
   * usuario y fallara el vínculo, quedaría alguien dentro del sistema sin ficha
   * y con una invitación que parece sin usar.
   *
   * El nombre sale de la ficha, no del token: Supabase no garantiza ninguno, y
   * el alumno ya está cargado en la academia con su nombre real.
   */
  private async crearDesdeInvitacion(
    id: string,
    email: string,
    invitacion: Invitacion & {
      cliente: { id: string; nombre: string; apellido: string; telefono: string | null } | null;
      instructor: { id: string; nombre: string; apellido: string; telefono: string | null } | null;
    },
  ): Promise<Usuario> {
    const ficha = invitacion.cliente ?? invitacion.instructor;

    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          id,
          email,
          nombre: ficha?.nombre ?? '',
          apellido: ficha?.apellido ?? '',
          telefono: ficha?.telefono ?? null,
          rol: invitacion.rol,
        },
      });

      if (invitacion.clienteId) {
        await tx.cliente.update({
          where: { id: invitacion.clienteId },
          data: { usuarioId: usuario.id },
        });
      }
      if (invitacion.instructorId) {
        await tx.instructor.update({
          where: { id: invitacion.instructorId },
          data: { usuarioId: usuario.id },
        });
      }

      await tx.invitacion.update({
        where: { id: invitacion.id },
        data: {
          estado: EstadoInvitacion.ACEPTADA,
          aceptadaAt: new Date(),
          aceptadaPor: usuario.id,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: 'INVITACION_ACEPTADA',
          entidad: 'Invitacion',
          entidadId: invitacion.id,
          detalle: { rol: invitacion.rol, conFicha: Boolean(ficha) },
        },
      });

      this.logger.log(
        `Alta de ${usuario.id} con rol ${invitacion.rol} por la invitación ${invitacion.id}`,
      );
      return usuario;
    });
  }

  /**
   * Puerta de arranque, para cuando todavía no hay nadie que pueda invitar.
   *
   * Solo funciona con la dirección exacta que esté en `ADMIN_INICIAL_EMAIL`, que
   * se carga en el servidor y no en ningún frontend. Hace falta en dos momentos:
   * la primera instalación, y cuando se rehace el proyecto de Supabase.
   *
   * Conviene vaciarla después del primer ingreso. Mientras esté puesta, quien
   * controle esa casilla puede crearse un administrador.
   */
  private async crearAdministradorInicial(id: string, email: string): Promise<Usuario> {
    this.logger.warn(
      `Alta del administrador inicial ${id} por ADMIN_INICIAL_EMAIL. ` +
        'Conviene vaciar esa variable ahora que ya hay un administrador.',
    );

    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: { id, email, nombre: '', apellido: '', rol: RolUsuario.ADMIN },
      });
      await tx.registroAuditoria.create({
        data: {
          usuarioId: usuario.id,
          accion: 'ADMIN_INICIAL_CREADO',
          entidad: 'Usuario',
          entidadId: usuario.id,
        },
      });
      return usuario;
    });
  }

  /** Perfil completo del usuario autenticado, con su ficha de cliente o instructor. */
  async obtenerPerfil(usuarioId: string) {
    return this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        rol: true,
        activo: true,
        consentimientoDatosAt: true,
        cliente: {
          select: { id: true, nombre: true, apellido: true, ciudad: true, fechaNacimiento: true },
        },
        instructor: {
          select: { id: true, habilitaMoto: true, habilitaAuto: true, colorAgenda: true },
        },
      },
    });
  }
}
