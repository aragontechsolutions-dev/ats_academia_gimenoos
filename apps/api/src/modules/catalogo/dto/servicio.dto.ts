import { Type } from 'class-transformer';
import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min,
} from 'class-validator';
import { TipoServicio, TipoVehiculo } from '@prisma/client';

export class CrearServicioDto {
  /** Identificador estable para enlaces y para el frontend. */
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'El slug va en minúsculas, sin espacios ni acentos (ej: pack-10-auto)',
  })
  @Length(3, 60)
  slug!: string;

  @IsString()
  @Length(3, 100)
  nombre!: string;

  @IsOptional()
  @IsString()
  @Length(1, 400)
  descripcion?: string;

  @IsEnum(TipoServicio)
  tipo!: TipoServicio;

  /** Null para servicios sin vehículo, como la gestoría del trámite. */
  @IsOptional()
  @IsEnum(TipoVehiculo)
  tipoVehiculo?: TipoVehiculo;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  cantidadClases!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  duracionMin!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioContado!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioTarjeta!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Si se muestra en la landing pública. */
  @IsOptional()
  @IsBoolean()
  publico?: boolean;
}

export class ActualizarServicioDto extends CrearServicioDto {}
