import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TipoVehiculo } from '@prisma/client';

export class ConsultarDisponibilidadDto {
  @IsEnum(TipoVehiculo)
  tipo!: TipoVehiculo;

  @Type(() => Date)
  @IsDate({ message: 'desde debe ser una fecha ISO válida' })
  desde!: Date;

  @Type(() => Date)
  @IsDate({ message: 'hasta debe ser una fecha ISO válida' })
  hasta!: Date;

  /** Duración de la clase. Entre 15 minutos y 4 horas. */
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  duracionMin!: number;

  @IsOptional()
  @IsUUID()
  instructorId?: string;
}
