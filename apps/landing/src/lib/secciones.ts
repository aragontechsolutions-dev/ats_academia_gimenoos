import definicion from '@gimenoos/shared/secciones-landing.json';

/**
 * Orden de las secciones del sitio.
 *
 * Sale del mismo archivo que usa la API, así el orden por defecto es uno solo.
 * En condiciones normales el orden lo manda la API —la academia puede
 * reordenarlo desde el panel—; esta lista es el respaldo para cuando la API no
 * responde, y también lo que hace que TypeScript avise si se agrega una sección
 * y nadie escribe el componente que la dibuja.
 */
export const SECCIONES_DEL_SITIO = definicion.secciones
  .filter((seccion) => seccion.enElSitio)
  .map((seccion) => seccion.clave);

/** Posición por defecto de una sección dentro de la página completa. */
export function ordenPorDefectoSeccion(clave: string): number {
  const indice = definicion.secciones.findIndex((seccion) => seccion.clave === clave);
  return indice === -1 ? 0 : indice;
}
