import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ReprogramarReservaDto {
  @Type(() => Date)
  @IsDate()
  inicio!: Date;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  duracionMin!: number;

  /** Permite mover la clase a otro instructor o vehículo en el mismo paso. */
  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsOptional()
  @IsUUID()
  vehiculoId?: string;
}
