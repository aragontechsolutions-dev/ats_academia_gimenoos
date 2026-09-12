import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { SupabaseJwtPayload } from './jwt-payload.interface';

/**
 * Verificacion local de los JWT de Supabase Auth.
 *
 * Supabase firma los tokens con criptografia asimetrica (ES256) y publica las
 * claves en el JWKS del proyecto. Verificamos la firma contra ese JWKS, sin
 * llamar a la API de Supabase en cada request: es mas rapido y no depende de
 * su disponibilidad. `jose` cachea el JWKS y lo refresca solo cuando aparece
 * un `kid` desconocido (rotacion de claves).
 *
 * Para proyectos que todavia usan el secreto compartido heredado (HS256) se
 * acepta ese algoritmo SOLO si se configura SUPABASE_JWT_LEGACY_SECRET.
 */
@Injectable()
export class SupabaseJwtService {
  private readonly logger = new Logger(SupabaseJwtService.name);
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;
  private readonly secretoHeredado?: Uint8Array;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL').replace(/\/+$/, '');
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));

    const secreto = this.config.get<string>('SUPABASE_JWT_LEGACY_SECRET');
    if (secreto && secreto.length > 0) {
      this.secretoHeredado = new TextEncoder().encode(secreto);
      this.logger.warn(
        'SUPABASE_JWT_LEGACY_SECRET configurado: se aceptan tokens HS256. ' +
          'Migra el proyecto a claves asimetricas (ES256) y quita esta variable.',
      );
    }
  }

  async verificar(token: string): Promise<SupabaseJwtPayload> {
    const opciones = {
      issuer: this.issuer,
      // Supabase emite los tokens de usuario con audiencia "authenticated".
      audience: 'authenticated',
    } as const;

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        ...opciones,
        algorithms: ['ES256', 'RS256'],
      });
      return payload as unknown as SupabaseJwtPayload;
    } catch (errorAsimetrico) {
      if (!this.secretoHeredado) {
        this.logger.debug(`Token rechazado: ${(errorAsimetrico as Error).message}`);
        throw new UnauthorizedException('Token invalido o expirado');
      }
    }

    try {
      const { payload } = await jwtVerify(token, this.secretoHeredado, {
        ...opciones,
        algorithms: ['HS256'],
      });
      return payload as unknown as SupabaseJwtPayload;
    } catch (errorHeredado) {
      this.logger.debug(`Token rechazado (HS256): ${(errorHeredado as Error).message}`);
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}
