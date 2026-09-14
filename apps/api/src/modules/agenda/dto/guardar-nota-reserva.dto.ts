import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cómo fue la clase, escrito por el instructor que la dio.
 *
 * La cadena vacía borra la nota, igual que en el resto del sistema. El tope de
 * largo no es decorativo: este texto entra desde un teléfono y termina en la
 * ficha de una persona.
 */
export class GuardarNotaReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La observación es demasiado larga' })
  nota?: string;
}
