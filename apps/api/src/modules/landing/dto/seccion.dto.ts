import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Un ítem de una sección: sirve para tarjetas, pasos, beneficios y también para
 * las preguntas frecuentes (la pregunta es el título y la respuesta el detalle).
 */
export class ItemSeccionDto {
  @IsString()
  @Length(1, 200)
  titulo!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  detalle?: string;
}

/**
 * Contenido editable de una sección.
 *
 * Todo es texto plano. El sitio lo renderiza como texto, nunca como HTML: React
 * escapa por defecto y en ningún lado se usa `dangerouslySetInnerHTML`. Si
 * alguna vez hiciera falta dar formato, hay que resolverlo con un subconjunto
 * controlado, no habilitando HTML.
 *
 * Los largos máximos no son decorativos: sin ellos, un texto de 50.000
 * caracteres rompe el diseño de la página y engorda cada respuesta de la API.
 */
export class ActualizarSeccionDto {
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  orden?: number;

  /** Null vacía el campo y devuelve la sección al texto por defecto del sitio. */
  @IsOptional()
  @IsString()
  @Length(0, 200)
  titulo?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 600)
  bajada?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  etiqueta?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  accion?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ItemSeccionDto)
  items?: ItemSeccionDto[];
}
