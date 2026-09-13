/**
 * Todo lo que el sitio y el panel necesitan saber de mapas y que no depende de
 * ninguna biblioteca.
 *
 * Vive acá porque las dos aplicaciones dibujan el MISMO punto: el sitio lo
 * muestra y el panel lo elige. Si cada una armara el enlace de ruta o eligiera
 * sus teselas por su cuenta, se desincronizarían sin que nada lo delate.
 */

/** Un punto en el mapa. Latitud y longitud siempre juntas: sueltas no ubican nada. */
export interface Coordenadas {
  latitud: number;
  longitud: number;
}

/**
 * Cuántos decimales se guardan.
 *
 * Seis son unos 11 centímetros. Más que eso es ruido del clic en el mapa, y
 * guardarlo solo hace que dos puntos iguales parezcan distintos.
 */
export const DECIMALES_COORDENADA = 6;

export function redondearCoordenada(valor: number): number {
  return Number(valor.toFixed(DECIMALES_COORDENADA));
}

/** Si el par es un punto real de la Tierra. */
export function coordenadasValidas(
  latitud: number | null | undefined,
  longitud: number | null | undefined,
): boolean {
  return (
    typeof latitud === 'number' &&
    typeof longitud === 'number' &&
    Number.isFinite(latitud) &&
    Number.isFinite(longitud) &&
    latitud >= -90 &&
    latitud <= 90 &&
    longitud >= -180 &&
    longitud <= 180
  );
}

/** Las coordenadas si están completas y son válidas; null si no. */
export function coordenadasDe(
  latitud: number | null | undefined,
  longitud: number | null | undefined,
): Coordenadas | null {
  if (!coordenadasValidas(latitud, longitud)) return null;
  return { latitud: latitud as number, longitud: longitud as number };
}

/**
 * Teselas del mapa: OpenStreetMap.
 *
 * Es gratis y no pide ninguna clave de API, que es justo lo que se buscaba. A
 * cambio exige mostrar la atribución, y por eso viaja pegada a la dirección: que
 * una sea obligatoria para usar la otra es la única forma de que nadie se olvide.
 *
 * El navegador de quien visita el sitio le pide las imágenes directamente a
 * openstreetmap.org, así que su IP llega hasta ahí. Es lo mismo que hace
 * cualquier mapa incrustado y está anotado en docs/20-mapa.md.
 */
export const TESELAS_OSM = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  atribucion: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  zoomMaximo: 19,
} as const;

/**
 * Enlace que abre Google Maps y traza la ruta hasta el local.
 *
 * Usa el esquema de URL documentado de Google Maps, que no necesita clave de
 * API. El origen NO se manda: lo pone Google con la ubicación de quien toca el
 * enlace, que es exactamente lo que se quiere —la ruta sale de donde esté la
 * persona— y además evita que el sitio tenga que pedirle su posición.
 *
 * `dir_action=navigate` arranca la navegación directamente en el teléfono.
 */
export function enlaceDeRuta(destino: Coordenadas): string {
  const punto = `${destino.latitud.toFixed(DECIMALES_COORDENADA)},${destino.longitud.toFixed(
    DECIMALES_COORDENADA,
  )}`;
  // A mano y no con `URLSearchParams`: este paquete lo comparten el servidor y
  // los navegadores, y su tsconfig no incluye ninguna de las dos librerías de
  // entorno a propósito. `encodeURIComponent` sí es del lenguaje.
  const destinoCodificado = encodeURIComponent(punto);
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&destination=${destinoCodificado}` +
    '&travelmode=driving' +
    '&dir_action=navigate'
  );
}

/**
 * El marcador del mapa, como SVG.
 *
 * Se dibuja con un icono propio y no con el de fábrica de Leaflet a propósito:
 * el de fábrica son dos PNG que Leaflet busca por una ruta relativa a su CSS, y
 * con un empaquetador esa ruta no existe. El síntoma es un mapa sin marcador,
 * sin ningún error. Además, así el punto lleva el color de la marca.
 */
export function svgDelMarcador(): string {
  // Sin parámetros a propósito. Este texto termina en un `innerHTML` —así es
  // como Leaflet arma los iconos—, y un hueco donde meter un valor de afuera es
  // un hueco por donde entra HTML ajeno. El color de la marca va escrito acá.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46" aria-hidden="true">
  <path d="M17 1C8.7 1 2 7.7 2 16c0 10.5 13.4 27 15 28.8C18.6 43 32 26.5 32 16 32 7.7 25.3 1 17 1z"
        fill="#e11d48" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="17" cy="16" r="5.5" fill="#ffffff"/>
</svg>`;
}

/** Tamaño y punto de anclaje del marcador, en píxeles. */
export const MARCADOR = { ancho: 34, alto: 46 } as const;
