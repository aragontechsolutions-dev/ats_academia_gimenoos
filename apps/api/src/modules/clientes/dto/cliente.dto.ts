import { Type } from 'class-transformer';
import {
  IsBoolean, IsDate, IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength,
} from 'class-validator';
import { TipoIdentificacion } from '@prisma/client';

export class CrearClienteDto {
  @IsString()
  @Length(2, 60)
  nombre!: string;

  @IsString()
  @Length(2, 60)
  apellido!: string;

  /**
   * Se acepta como lo escriba la persona y el servicio lo normaliza a
   * `+598 98663201`. Acá solo se acota el largo: la validación de verdad, con
   * su mensaje explicando qué se espera, vive en `normalizarTelefono`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(25, { message: 'El teléfono es demasiado largo' })
  telefono?: string;

  /** Con este correo se vincula la ficha si el alumno se crea una cuenta después. */
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email?: string;

  /** Cédula uruguaya o pasaporte, para un alumno extranjero. */
  @IsOptional()
  @IsEnum(TipoIdentificacion, { message: 'El tipo de documento tiene que ser CEDULA o PASAPORTE' })
  tipoDocumento?: TipoIdentificacion;

  /** País emisor del pasaporte, ISO 3166-1 alfa-2. Para la cédula siempre es UY. */
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'El país va con su código de dos letras (por ejemplo BR)' })
  paisDocumento?: string;

  /**
   * Número del documento. La cédula se limpia de puntos y guiones; el pasaporte
   * se guarda en mayúsculas. Ver `normalizarDocumento`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(25, { message: 'El documento es demasiado largo' })
  documento?: string;

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
  @MaxLength(25, { message: 'El teléfono es demasiado largo' })
  telefono?: string;

  @IsOptional()
  @IsEnum(TipoIdentificacion, { message: 'El tipo de documento tiene que ser CEDULA o PASAPORTE' })
  tipoDocumento?: TipoIdentificacion;

  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'El país va con su código de dos letras (por ejemplo BR)' })
  paisDocumento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25, { message: 'El documento es demasiado largo' })
  documento?: string;

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
