import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { RolUsuario, type Usuario } from '@prisma/client';
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
        cliente: { select: { id: true, ciudad: true, fechaNacimiento: true } },
        instructor: {
          select: { id: true, habilitaMoto: true, habilitaAuto: true, colorAgenda: true },
        },
      },
    });
  }
}
