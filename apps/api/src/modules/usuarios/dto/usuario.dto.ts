import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { RolUsuario } from '@prisma/client';

import { ConsultaPaginadaDto } from '../../../common/paginacion/paginacion';

/**
 * Parámetros del listado de cuentas.
 *
 * Declara TODOS los que acepta el endpoint, no solo la paginación: `@Query()`
 * valida el objeto entero de parámetros contra este DTO y cualquiera que falte
 * devuelve 400. Ya nos pasó dos veces.
 */
export class ListarUsuariosDto extends ConsultaPaginadaDto {
  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  incluirInactivos?: boolean;

  /** Busca por nombre, apellido o correo. */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  q?: string;
}

/** Lo único que un administrador puede cambiarle a la cuenta de otra persona. */
export class ActualizarUsuarioDto {
  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activo?: boolean;
}
