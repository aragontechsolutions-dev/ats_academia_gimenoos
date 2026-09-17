import { NOMBRE_DE_SECCION, type SeccionDeContacto } from './dto/contacto-whatsapp.dto';
import { escaparHtml } from '../../common/telegram/telegram.service';

/**
 * De dónde venía la visita, en una palabra.
 *
 * Del referrer se queda SÓLO el dominio. Lo que sigue —la ruta, la consulta—
 * puede tener cualquier cosa, incluidos datos de quien buscó, y no aporta nada
 * a la pregunta que se está contestando: «¿esto lo trajo Google o Instagram?».
 *
 * Se le saca el `www.` porque «google.com» y «www.google.com» son lo mismo para
 * quien lee el aviso.
 */
export function origenLegible(desde: string | undefined): string {
  if (!desde) return 'entró directo';
  try {
    const dominio = new URL(desde).hostname.replace(/^www\./, '');
    return dominio ? `vino de ${dominio}` : 'entró directo';
  } catch {
    // Un referrer que no es una dirección válida no se muestra: decir «vino de
    // basura» es peor que no decir nada.
    return 'entró directo';
  }
}

/**
 * Celular o computadora, mirando el User-Agent.
 *
 * Lo decide el servidor y no el navegador a propósito: el dato viaja igual en
 * cada petición y así no hay un campo más que alguien pueda inventar desde
 * afuera.
 *
 * Es una heurística y no pretende ser otra cosa. Para «la mayoría entra desde
 * el teléfono» alcanza y sobra; para una estadística fina no serviría, y no es
 * lo que se está preguntando.
 */
export function dispositivoLegible(userAgent: string | undefined): string {
  if (!userAgent) return 'dispositivo desconocido';
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? 'desde el celular' : 'desde una computadora';
}

/**
 * El aviso que llega al teléfono de quien atiende.
 *
 * Deliberadamente NO lleva nada de quien tocó el botón: ni IP, ni identificador,
 * ni nada que permita reconocer a una persona. Lo único que se informa es que
 * hubo una consulta y desde qué parte del sitio salió, que es lo que sirve para
 * atender y para saber qué está trayendo gente.
 */
export function mensajeDeContacto(
  seccion: SeccionDeContacto,
  hora: string,
  dispositivo: string,
  origen: string,
): string {
  return (
    '<b>Alguien va a escribir por WhatsApp</b>\n' +
    `Desde: ${escaparHtml(NOMBRE_DE_SECCION[seccion])}\n` +
    `Hora: ${escaparHtml(hora)}\n` +
    `${escaparHtml(dispositivo)}, ${escaparHtml(origen)}`
  );
}
