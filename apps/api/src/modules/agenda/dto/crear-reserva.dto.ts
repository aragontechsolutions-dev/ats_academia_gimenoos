import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { TipoVehiculo } from '@prisma/client';

export class CrearReservaDto {
  /**
   * A quién se le agenda la clase. Solo lo puede indicar un ADMIN o un
   * INSTRUCTOR: si lo envía un CLIENTE, el servicio lo ignora y usa su propia
   * ficha. Sin eso, cualquiera podría agendar clases a nombre de otro.
   */
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsUUID()
  instructorId!: string;

  @IsUUID()
  vehiculoId!: string;

  @IsEnum(TipoVehiculo)
  tipo!: TipoVehiculo;

  @Type(() => Date)
  @IsDate()
  inicio!: Date;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  duracionMin!: number;

  /** Descuenta una clase de un pack ya comprado. */
  @IsOptional()
  @IsUUID()
  compraId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lugarEncuentro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
