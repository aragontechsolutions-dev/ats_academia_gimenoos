import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoExcepcion } from '@prisma/client';

export class CrearInstructorDto {
  @IsString()
  @Length(2, 60)
  nombre!: string;

  @IsString()
  @Length(2, 60)
  apellido!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d\s+()-]{8,20}$/, { message: 'El teléfono no tiene un formato válido' })
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  habilitaMoto?: boolean;

  @IsOptional()
  @IsBoolean()
  habilitaAuto?: boolean;

  /** Color con el que se distingue en el calendario del panel. */
  @IsOptional()
  @IsHexColor()
  colorAgenda?: string;

  /** Usuario de Supabase con el que el instructor entra al sistema, si lo tiene. */
  @IsOptional()
  @IsUUID()
  usuarioId?: string;
}

export class ActualizarInstructorDto extends CrearInstructorDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/**
 * Una franja de la plantilla semanal.
 * Las horas van en minutos desde medianoche, en hora local de la academia:
 * la plantilla es una regla ("los martes de 9 a 13"), no un instante.
 */
export class FranjaDisponibilidadDto {
  /** 0 = domingo … 6 = sábado */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  minutoInicio!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  minutoFin!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  vigenteDesde?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  vigenteHasta?: Date;
}

/** Reemplaza la plantilla completa del instructor. */
export class ReemplazarDisponibilidadDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FranjaDisponibilidadDto)
  franjas!: FranjaDisponibilidadDto[];
}

export class CrearExcepcionDto {
  @IsEnum(TipoExcepcion)
  tipo!: TipoExcepcion;

  @Type(() => Date)
  @IsDate()
  inicio!: Date;

  @Type(() => Date)
  @IsDate()
  fin!: Date;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  motivo?: string;
}
