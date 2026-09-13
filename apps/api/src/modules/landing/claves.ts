import definicion from '@gimenoos/shared/secciones-landing.json';

/**
 * Secciones configurables del sitio.
 *
 * La lista vive en `packages/shared/secciones-landing.json`, compartida con el
 * sitio: el orden por defecto tiene que ser el mismo en los dos lados y una
 * lista duplicada se desincroniza sola. Ya pasó una vez —el formulario de
 * contacto apareció antes que las preguntas frecuentes— y el síntoma es una
 * página desordenada, sin ningún error que lo delate.
 *
 * Acá se le ponen los tipos; el dato es uno solo.
 */
export interface DefinicionSeccion {
  clave: string;
  nombre: string;
  /** Si la sección admite una lista de ítems editables. */
  items: boolean;
  /** Si el sitio la dibuja como un bloque propio y participa del orden. */
  enElSitio: boolean;
}

export const SECCIONES_LANDING: readonly DefinicionSeccion[] = definicion.secciones;

const CLAVES: ReadonlySet<string> = new Set(SECCIONES_LANDING.map((seccion) => seccion.clave));

export function esClaveValida(clave: string): boolean {
  return CLAVES.has(clave);
}

/** Posición por defecto de una sección, para cuando nadie tocó el orden. */
export function ordenPorDefecto(clave: string): number {
  const indice = SECCIONES_LANDING.findIndex((seccion) => seccion.clave === clave);
  return indice === -1 ? 0 : indice;
}
