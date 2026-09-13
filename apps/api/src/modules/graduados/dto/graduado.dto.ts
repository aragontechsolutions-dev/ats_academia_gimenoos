import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { CategoriaLicencia } from '@prisma/client';

export class CrearGraduadoDto {
  @IsUUID()
  clienteId!: string;

  @IsEnum(CategoriaLicencia)
  categoria!: CategoriaLicencia;

  /** Fecha de egreso, en formato YYYY-MM-DD. El año se deriva de acá. */
  @IsDateString()
  fechaEgreso!: string;

  /**
   * Fecha de la firma de la autorización para publicar.
   * Sin esto el egresado se guarda igual, pero no se puede publicar: eso lo
   * impide una constraint de la base, no solo esta validación.
   */
  @IsOptional()
  @IsDateString()
  autorizacionAt?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 150)
  autorizacionFirmante?: string | null;

  /** true cuando quien firmó es el padre, madre o tutor de un menor de edad. */
  @IsOptional()
  @IsBoolean()
  autorizacionEsTutor?: boolean;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notas?: string | null;

  /**
   * Ruta de la foto DENTRO del bucket, no una dirección completa.
   *
   * Se valida la forma exacta a propósito. Si se aceptara una URL cualquiera,
   * quien tenga acceso al panel podría apuntar la foto de un egresado a
   * cualquier servidor de internet: una imagen distinta, un rastreador, o algo
   * peor, servido desde el sitio de la academia como si fuera propio.
   *
   * La dirección pública la arma la API a partir de esta ruta.
   */
  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== null && valor !== '')
  @IsString()
  @Length(0, 200)
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9._-]{1,80}\.(jpg|jpeg|webp)$/, {
    message: 'La ruta de la foto no tiene la forma esperada (<id del egresado>/<archivo>.jpg)',
  })
  fotoRuta?: string | null;
}

export class ActualizarGraduadoDto extends CrearGraduadoDto {
  @IsOptional()
  @IsUUID()
  declare clienteId: string;

  @IsOptional()
  @IsEnum(CategoriaLicencia)
  declare categoria: CategoriaLicencia;

  @IsOptional()
  @IsDateString()
  declare fechaEgreso: string;
}

/**
 * Paginado de la galería pública.
 *
 * El tamaño de página está acotado a una lista cerrada: sin eso, `porPagina=100000`
 * convierte un endpoint público en una forma barata de tumbar la base.
 */
export const TAMANOS_PAGINA = [10, 20, 50, 100] as const;

export class ConsultaGaleriaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...TAMANOS_PAGINA], {
    message: `Los tamaños de página permitidos son ${TAMANOS_PAGINA.join(', ')}`,
  })
  porPagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  anio?: number;
}
