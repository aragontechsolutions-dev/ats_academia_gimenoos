import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ES_PUBLICO } from './publico.decorator';
import { SupabaseJwtService } from './supabase-jwt.service';
import { UsuariosService } from '../../modules/usuarios/usuarios.service';
import type { UsuarioAutenticado } from './jwt-payload.interface';

/**
 * Guard global de autenticacion.
 *
 * Todo endpoint requiere un Bearer token valido salvo que se marque con @Publico().
 * El rol autorizado se toma de la tabla `usuarios` (fuente de verdad), no del token:
 * asi un cambio de rol o una baja tienen efecto inmediato sin esperar a que expire
 * el JWT del usuario.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
    private readonly usuarios: UsuariosService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;

    const request = contexto.switchToHttp().getRequest<Request & { usuario?: UsuarioAutenticado }>();
    const token = this.extraerToken(request);
    if (!token) {
      throw new UnauthorizedException('Falta el encabezado Authorization: Bearer <token>');
    }

    const payload = await this.jwt.verificar(token);
    request.usuario = await this.usuarios.resolverDesdeToken(payload);
    return true;
  }

  private extraerToken(request: Request): string | undefined {
    const encabezado = request.headers.authorization;
    if (!encabezado) return undefined;
    const [esquema, valor] = encabezado.split(' ');
    return esquema?.toLowerCase() === 'bearer' && valor ? valor : undefined;
  }
}
