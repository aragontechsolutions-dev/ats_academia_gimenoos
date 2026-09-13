/** Lado más largo al que se reduce cada foto antes de subirla. */
const LADO_MAXIMO = 1000;

/** Calidad del JPEG resultante. 0.82 es el punto donde deja de notarse. */
const CALIDAD = 0.82;

/** Tope de entrada. Una foto de celular ronda los 3-6 MB. */
export const TAMANO_MAXIMO_ENTRADA = 12 * 1024 * 1024;

export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export interface ImagenPreparada {
  archivo: Blob;
  anchoOriginal: number;
  altoOriginal: number;
  ancho: number;
  alto: number;
  bytesOriginal: number;
  bytes: number;
}

/**
 * Prepara una foto para subirla: la achica y la vuelve a codificar.
 *
 * Hace dos cosas, y la segunda es la que importa:
 *
 * 1. **La achica a 1000 px** en su lado más largo. Una foto de celular pesa
 *    varios megas; cien de esas en una galería hacen que la página tarde una
 *    eternidad en un 4G.
 *
 * 2. **Le saca los metadatos.** Al redibujarla en un canvas y volver a
 *    codificarla, el archivo resultante NO conserva los EXIF del original.
 *    Entre esos metadatos suele venir la **ubicación GPS exacta** donde se sacó
 *    la foto, además del modelo del teléfono y la fecha. Subir la foto tal cual
 *    sale de la cámara publicaría las coordenadas de la academia —o de la casa
 *    del alumno— en un archivo que cualquiera puede descargar y abrir.
 *
 * Devuelve siempre un JPEG: es lo que acepta el bucket y lo que entiende
 * cualquier navegador.
 */
export async function prepararFoto(archivo: File): Promise<ImagenPreparada> {
  if (archivo.size > TAMANO_MAXIMO_ENTRADA) {
    throw new Error('La imagen es demasiado grande. El máximo son 12 MB.');
  }

  const bitmap = await cargarImagen(archivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo procesar la imagen.');

  // Fondo blanco: un PNG con transparencia, al pasar a JPEG, queda negro.
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(bitmap, 0, 0, ancho, alto);

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', CALIDAD),
  );
  if (!blob) throw new Error('No se pudo convertir la imagen.');

  return {
    archivo: blob,
    anchoOriginal: bitmap.width,
    altoOriginal: bitmap.height,
    ancho,
    alto,
    bytesOriginal: archivo.size,
    bytes: blob.size,
  };
}

/**
 * Carga la imagen respetando la orientación que indica el EXIF.
 *
 * `createImageBitmap` con `imageOrientation: 'from-image'` aplica la rotación
 * del EXIF al dibujar. Sin eso, las fotos verticales de celular se suben
 * acostadas: la cámara guarda los píxeles apaisados y deja la rotación en los
 * metadatos, que es justo lo que este proceso descarta.
 */
async function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch {
      // Algunos navegadores no soportan la opción; se sigue por el camino largo.
    }
  }

  const url = URL.createObjectURL(archivo);
  try {
    return await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const imagen = new Image();
      imagen.onload = () => resolver(imagen);
      imagen.onerror = () => rechazar(new Error('El archivo no es una imagen válida.'));
      imagen.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Para mostrar tamaños en la interfaz. */
export function enKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}
