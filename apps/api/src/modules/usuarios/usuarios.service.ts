import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { RolUsuario, type Prisma, type Usuario } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { SupabaseJwtPayload, UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resuelve el usuario local a partir de un JWT ya verificado.
   *
   * Si es su primer acceso se crea el registro local (aprovisionamiento JIT) con
   * el rol que venga en `app_metadata.rol`, que solo puede escribirse con la clave
   * service_role. Si el usuario ya existe, el rol de la base manda: un token viejo
   * nunca puede devolverle privilegios a alguien a quien se le cambio el rol.
   */
  async resolverDesdeToken(payload: SupabaseJwtPayload): Promise<UsuarioAutenticado> {
    const existente = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });

    const usuario = existente ?? (await this.crearDesdeToken(payload));

    if (!usuario.activo) {
      throw new ForbiddenException('La cuenta esta deshabilitada');
    }

    if (!existente && usuario.rol === RolUsuario.CLIENTE) {
      await this.vincularFichaDeAlumno(usuario);
    }

    return { id: usuario.id, email: usuario.email, rol: usuario.rol };
  }

  private async crearDesdeToken(payload: SupabaseJwtPayload): Promise<Usuario> {
    const email = payload.email ?? `${payload.sub}@sin-email.local`;
    const rolDelToken = payload.app_metadata?.rol;
    const rol = rolDelToken && rolDelToken in RolUsuario ? rolDelToken : RolUsuario.CLIENTE;

    this.logger.log(`Alta de usuario local ${payload.sub} con rol ${rol}`);

    return this.prisma.usuario.create({
      data: {
        id: payload.sub,
        email,
        // El nombre real se completa desde el perfil; el JWT no lo garantiza.
        nombre: '',
        apellido: '',
        rol,
      },
    });
  }

  /**
   * Conecta la cuenta recien creada con la ficha de alumno que le corresponda.
   *
   * El caso normal en una academia es al reves de lo que uno supondria: primero
   * la academia registra al alumno en el local, y recien despues el alumno se
   * crea la cuenta para ver sus clases. Sin este paso quedarian dos registros
   * de la misma persona y el alumno no veria su historial.
   *
   * Se vincula por correo y SOLO si hay exactamente una ficha candidata sin
   * cuenta asociada. Ante dos coincidencias no se adivina: se crea una ficha
   * nueva y la academia decide, porque vincular mal expondria los datos de otro
   * alumno a la persona equivocada.
   */
  private async vincularFichaDeAlumno(usuario: Usuario): Promise<void> {
    const candidatas = await this.prisma.cliente.findMany({
      where: { usuarioId: null, email: usuario.email },
      select: { id: true },
      take: 2,
    });

    if (candidatas.length === 1) {
      await this.prisma.cliente.update({
        where: { id: candidatas[0]!.id },
        data: { usuarioId: usuario.id },
      });
      this.logger.log(`Ficha de alumno ${candidatas[0]!.id} vinculada al usuario ${usuario.id}`);
      return;
    }

    const nueva: Prisma.ClienteCreateInput = {
      nombre: usuario.nombre || 'Sin nombre',
      apellido: usuario.apellido || 'Sin apellido',
      email: usuario.email,
      telefono: usuario.telefono,
      usuario: { connect: { id: usuario.id } },
    };
    const creada = await this.prisma.cliente.create({ data: nueva, select: { id: true } });

    if (candidatas.length > 1) {
      this.logger.warn(
        `Hay mas de una ficha sin cuenta con el correo ${usuario.email}: se creo la ficha ` +
          `${creada.id} sin vincular. Un administrador debe unificarlas.`,
      );
    }
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
