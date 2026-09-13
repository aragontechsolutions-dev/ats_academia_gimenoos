import { Type } from 'class-transformer';
import {
  IsBoolean, IsDate, IsEmail, IsOptional, IsString, Length, Matches, MaxLength,
} from 'class-validator';

export class CrearClienteDto {
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

  /** Con este correo se vincula la ficha si el alumno se crea una cuenta después. */
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email?: string;

  /** Cédula uruguaya: solo dígitos, con el verificador incluido. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{7,8}$/, { message: 'La cédula son 7 u 8 dígitos, sin puntos ni guiones' })
  cedula?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaNacimiento?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notasInternas?: string;
}

export class ActualizarClienteDto extends CrearClienteDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class BuscarClientesDto {
  /** Busca por nombre, apellido, correo o cédula. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  incluirInactivos?: boolean;
}

/**
 * Datos que el propio alumno puede editar desde la PWA.
 *
 * Deliberadamente NO incluye `activo` ni `notasInternas`: dar de baja una ficha
 * es una decisión de la academia, y las notas internas son observaciones del
 * instructor que el alumno no debería poder leer ni escribir.
 */
export class ActualizarMiFichaDto {
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
  @IsString()
  @Matches(/^\d{7,8}$/, { message: 'La cédula son 7 u 8 dígitos, sin puntos ni guiones' })
  cedula?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaNacimiento?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string;
}
