import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @Length(0, 40)
  telefono?: string;

  /**
   * Solo dígitos, con código de país y sin símbolos (ej: 59899123456). Es lo que
   * pide la API de wa.me; un número con espacios o con "+" genera un enlace roto,
   * y un enlace roto convierte peor que no tener botón.
   */
  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== '')
  @IsString()
  @Matches(/^[0-9]{8,15}$/, {
    message: 'El WhatsApp va solo con dígitos, con código de país y sin espacios (ej: 59899123456)',
  })
  whatsapp?: string;

  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== '')
  @IsString()
  @Length(5, 120)
  @Matches(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: 'El correo no tiene un formato válido' })
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
