import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '@prisma/client';

export const ROLES_REQUERIDOS = 'roles_requeridos';

/** Restringe un endpoint a uno o mas roles. Se evalua despues de la autenticacion. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_REQUERIDOS, roles);
