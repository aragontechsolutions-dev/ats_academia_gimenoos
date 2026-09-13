/**
 * Secciones del sitio público que se pueden configurar desde el panel.
 *
 * La lista es cerrada a propósito: la API rechaza cualquier clave que no esté
 * acá. Si fuera abierta, un error de tipeo crearía una sección fantasma que el
 * sitio nunca lee y que nadie encuentra después para borrar.
 *
 * El orden de esta lista es el orden por defecto de las secciones en el sitio.
 */
export const SECCIONES_LANDING = [
  { clave: 'hero', nombre: 'Portada', items: false },
  { clave: 'beneficios', nombre: 'Barra de confianza', items: true },
  { clave: 'porQue', nombre: 'Por qué Gimenoos', items: true },
  { clave: 'modalidades', nombre: 'Clases de moto y auto', items: false },
  { clave: 'opciones', nombre: 'Opciones dentro de las clases', items: true },
  { clave: 'proceso', nombre: 'Cómo funciona', items: true },
  { clave: 'vehiculos', nombre: 'Vehículos', items: false },
  { clave: 'planes', nombre: 'Planes y precios', items: false },
  { clave: 'tramite', nombre: 'Trámite de la libreta', items: true },
  { clave: 'instructores', nombre: 'Instructores', items: false },
  { clave: 'testimonios', nombre: 'Testimonios', items: false },
  { clave: 'galeria', nombre: 'Galería', items: false },
  { clave: 'ubicacion', nombre: 'Dónde estamos', items: false },
  // Las preguntas van antes del formulario: se responden las objeciones y
  // recién ahí se pide el contacto. Este orden tiene que coincidir con el de
  // `SECCIONES` en apps/landing/src/App.tsx, que es el respaldo si la API cae.
  { clave: 'preguntas', nombre: 'Preguntas frecuentes', items: true },
  { clave: 'contacto', nombre: 'Contacto', items: false },
  { clave: 'ctaFinal', nombre: 'Llamada final a la acción', items: false },
] as const;

export type ClaveSeccion = (typeof SECCIONES_LANDING)[number]['clave'];

const CLAVES = new Set<string>(SECCIONES_LANDING.map((seccion) => seccion.clave));

export function esClaveValida(clave: string): clave is ClaveSeccion {
  return CLAVES.has(clave);
}

/** Posición por defecto de una sección, para cuando nadie tocó el orden. */
export function ordenPorDefecto(clave: string): number {
  const indice = SECCIONES_LANDING.findIndex((seccion) => seccion.clave === clave);
  return indice === -1 ? 0 : indice;
}
