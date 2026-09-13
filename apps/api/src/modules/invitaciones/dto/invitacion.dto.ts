import { IsEmail, IsEnum, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class CrearInvitacionDto {
  /**
   * A quién se invita. Opcional cuando se invita a una ficha que ya tiene
   * correo cargado: en ese caso se usa el de la ficha.
   */
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(254)
  email?: string;

  @IsEnum(RolUsuario)
  rol!: RolUsuario;

  /** Ficha de alumno a la que queda atada la cuenta. Solo para rol CLIENTE. */
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  /** Ficha de instructor a la que queda atada la cuenta. Solo para INSTRUCTOR. */
  @IsOptional()
  @IsUUID()
  instructorId?: string;
}
