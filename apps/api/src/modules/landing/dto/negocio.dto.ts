import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Datos de contacto del negocio.
 *
 * Cada campo opcional acepta también la cadena vacía, que significa "borrar este
 * dato". El sitio oculta lo que esté vacío en vez de mostrar un marcador: es
 * preferible que falte un dato a que aparezca uno inventado.
 */
export class ActualizarNegocioDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  direccion?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  ciudad?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  departamento?: string;

  /**
   * Mismo trato que el teléfono de un alumno o de un instructor: se acepta como
   * lo escriba la persona y el servicio lo normaliza a `+598 98663201`. Acá solo
   * se acota el largo; la validación de verdad, con su mensaje explicando qué se
   * espera, vive en `normalizarTelefono`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(25, { message: 'El teléfono es demasiado largo' })
  telefono?: string;

  /**
   * El WhatsApp se trata como cualquier otro teléfono.
   *
   * Antes se exigían dígitos con código de país y sin símbolos. Esa regla dejaba
   * pasar `092331784` —un celular uruguayo escrito como se escribe acá, nueve
   * dígitos— y con eso el enlace de wa.me abría un chat con un número de otro
   * país. Sin ningún error: el botón existía y no llevaba a nadie.
   *
   * Normalizado, queda `+598 92331784`, y el enlace se arma a partir de ahí.
   */
  @IsOptional()
  @IsString()
  @MaxLength(25, { message: 'El WhatsApp es demasiado largo' })
  whatsapp?: string;

  /**
   * La misma comprobación que el correo de un alumno: `IsEmail`, y no una
   * expresión regular escrita a mano. La cadena vacía sigue borrando el dato.
   */
  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== '')
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  horarios?: string;

  /**
   * Los enlaces se validan contra http/https a propósito.
   *
   * Un `href` que empieza con `javascript:` ejecuta código en el navegador de
   * quien visita el sitio. Como estos valores los escribe una persona en el
   * panel y terminan en un atributo `href` de la página pública, aceptar
   * cualquier esquema sería abrir un XSS desde el propio panel.
   */
  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== '')
  @IsString()
  @Length(0, 500)
  @Matches(/^https?:\/\/[^\s]+$/i, { message: 'El enlace tiene que empezar con http:// o https://' })
  mapaUrl?: string;

  /**
   * Coordenadas del local.
   *
   * `null` borra el punto del mapa; `undefined` lo deja como está. Que vengan
   * las dos o ninguna lo comprueba el servicio, porque es una regla entre dos
   * campos y acá cada uno se valida por separado.
   *
   * Son números, no texto: llegan de un clic en el mapa del panel.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitud?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitud?: number | null;

  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== '')
  @IsString()
  @Length(0, 500)
  @Matches(/^https?:\/\/[^\s]+$/i, { message: 'El enlace tiene que empezar con http:// o https://' })
  instagram?: string;

  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== '')
  @IsString()
  @Length(0, 500)
  @Matches(/^https?:\/\/[^\s]+$/i, { message: 'El enlace tiene que empezar con http:// o https://' })
  facebook?: string;
}
