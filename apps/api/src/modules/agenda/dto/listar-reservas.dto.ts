import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoReserva } from '@prisma/client';

export class ListarReservasDto {
  @Type(() => Date)
  @IsDate({ message: 'desde debe ser una fecha ISO válida' })
  desde!: Date;

  @Type(() => Date)
  @IsDate({ message: 'hasta debe ser una fecha ISO válida' })
  hasta!: Date;

  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsOptional()
  @IsUUID()
  vehiculoId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsEnum(EstadoReserva)
  estado?: EstadoReserva;
}
