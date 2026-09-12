import type { RolUsuario } from '@prisma/client';

/**
 * Claims del JWT emitido por Supabase Auth que usa la aplicacion.
 *
 * `app_metadata` solo puede escribirse con la clave service_role (desde el backend
 * o el panel de Supabase), nunca por el propio usuario: por eso es el lugar correcto
 * para el rol. `user_metadata` SI es editable por el usuario, asi que jamas debe
 * usarse para decisiones de autorizacion.
 */
export interface SupabaseJwtPayload {
  /** UUID del usuario en auth.users. Es el id de nuestra tabla `usuarios`. */
  sub: string;
  email?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  app_metadata?: {
    rol?: RolUsuario;
    [clave: string]: unknown;
  };
  user_metadata?: Record<string, unknown>;
}

/** Usuario autenticado tal como queda disponible en `request.usuario`. */
export interface UsuarioAutenticado {
  id: string;
  email: string;
  rol: RolUsuario;
}
