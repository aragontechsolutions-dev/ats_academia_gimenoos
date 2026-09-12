import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UsuarioAutenticado } from './jwt-payload.interface';

/** Inyecta el usuario autenticado en el handler del controlador. */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx.switchToHttp().getRequest<Request & { usuario?: UsuarioAutenticado }>();
    if (!request.usuario) {
      throw new Error(
        'UsuarioActual se uso en una ruta sin autenticacion. Quita @Publico() o el decorador.',
      );
    }
    return request.usuario;
  },
);
