import { digitosParaWhatsApp } from '@gimenoos/shared';

/**
 * El teléfono del alumno, listo para `wa.me`.
 *
 * Las reglas son las mismas que usa la API para guardar el número y el sitio
 * público para su botón: viven en `@gimenoos/shared`. Devuelve null cuando el
 * número no se puede convertir con seguridad, y ahí la tarjeta no dibuja el
 * enlace: antes que abrir un chat con quien no es, no hay enlace.
 */
export function numeroParaWhatsApp(telefono: string | null | undefined): string | null {
  return digitosParaWhatsApp(telefono);
}
