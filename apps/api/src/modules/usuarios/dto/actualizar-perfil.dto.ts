import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class ActualizarPerfilDto {
  @IsString()
  @Length(2, 60)
  nombre!: string;

  @IsString()
  @Length(2, 60)
  apellido!: string;

  /** Telefono uruguayo en formato flexible: digitos, espacios, +, guiones. */
  @IsOptional()
  @IsString()
  @Matches(/^[\d\s+()-]{8,20}$/, { message: 'El telefono no tiene un formato valido' })
  telefono?: string;
}
