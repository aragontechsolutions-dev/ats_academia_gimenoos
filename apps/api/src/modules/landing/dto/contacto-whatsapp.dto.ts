import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Desde dónde se tocó WhatsApp.
 *
 * Es una lista cerrada y no texto libre, por dos motivos. El primero es de
 * seguridad: este endpoint es público y lo que llegue termina dentro de un
 * mensaje de Telegram, así que nadie puede elegir qué dice ese mensaje. El
 * segundo es práctico: si mañana se agrega un botón y no está acá, el error
 * salta en el momento y no seis meses después leyendo avisos que dicen
 * "undefined".
 */
export enum SeccionDeContacto {
  HERO = 'hero',
  ENCABEZADO = 'encabezado',
  MODALIDADES = 'modalidades',
  PLANES = 'planes',
  CTA_FINAL = 'cta-final',
  PIE = 'pie',
  BOTON_FLOTANTE = 'boton-flotante',
  FORMULARIO = 'formulario',
}

/** Cómo se nombra cada sección en el aviso que llega al teléfono. */
export const NOMBRE_DE_SECCION: Record<SeccionDeContacto, string> = {
  [SeccionDeContacto.HERO]: 'Portada',
  [SeccionDeContacto.ENCABEZADO]: 'Menú de arriba',
  [SeccionDeContacto.MODALIDADES]: 'Modalidades',
  [SeccionDeContacto.PLANES]: 'Planes y precios',
  [SeccionDeContacto.CTA_FINAL]: 'Cierre de la página',
  [SeccionDeContacto.PIE]: 'Pie de página',
  [SeccionDeContacto.BOTON_FLOTANTE]: 'Botón flotante',
  [SeccionDeContacto.FORMULARIO]: 'Formulario de contacto',
};

export class ContactoWhatsAppDto {
  @ApiProperty({ enum: SeccionDeContacto })
  @IsEnum(SeccionDeContacto, {
    message: 'seccion no es una de las secciones del sitio',
  })
  seccion!: SeccionDeContacto;

  /**
   * De qué página venía la visita, tal como lo informa el navegador.
   *
   * Llega entero y la API se queda sólo con el dominio. Eso hace dos cosas:
   * acorta el aviso —nadie necesita leer una dirección de Google con sesenta
   * caracteres de parámetros— y de paso descarta lo que pueda venir colgado en
   * la ruta o en la consulta.
   */
  @ApiPropertyOptional({ example: 'https://www.google.com/search?q=...' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La dirección de origen es demasiado larga' })
  desde?: string;
}
