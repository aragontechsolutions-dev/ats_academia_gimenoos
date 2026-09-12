import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RolUsuario } from '@prisma/client';
import { ROLES_REQUERIDOS } from './roles.decorator';
import type { UsuarioAutenticado } from './jwt-payload.interface';

/** Autorizacion por rol. Se ejecuta despues de SupabaseAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_REQUERIDOS, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const request = contexto.switchToHttp().getRequest<Request & { usuario?: UsuarioAutenticado }>();
    const usuario = request.usuario;

    if (!usuario || !rolesRequeridos.includes(usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para acceder a este recurso');
    }
    return true;
  }
}
