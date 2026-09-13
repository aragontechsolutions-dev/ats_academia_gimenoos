import { IsEmail, IsEnum, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { CanalInvitacion, EstadoInvitacion, RolUsuario } from '@prisma/client';

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

  /**
   * Por dónde se le hace llegar el acceso.
   *
   * `CORREO` (por defecto) hace que Supabase mande el correo. `ENLACE` devuelve
   * el enlace una sola vez para que la academia lo mande por su cuenta, que es
   * lo que se usa cuando la persona llegó por WhatsApp.
   */
  @IsOptional()
  @IsEnum(CanalInvitacion)
  canal?: CanalInvitacion;
}

/** Cuerpo de un reenvío: permite cambiar de canal sin crear otra invitación. */
export class ReenviarInvitacionDto {
  @IsOptional()
  @IsEnum(CanalInvitacion)
  canal?: CanalInvitacion;
}

/**
 * Parámetros del listado de invitaciones.
 *
 * Sin `clienteId` devuelve todas, que es lo que necesita la pantalla de cuentas
 * para mostrar quién está invitado y todavía no entró.
 */
export class ListarInvitacionesDto {
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsOptional()
  @IsEnum(EstadoInvitacion)
  estado?: EstadoInvitacion;
}
