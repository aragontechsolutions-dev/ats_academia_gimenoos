/** Lado más largo al que se reduce cada foto antes de subirla. */
const LADO_MAXIMO = 1000;

/** Calidad del JPEG resultante. 0.82 es el punto donde deja de notarse. */
const CALIDAD = 0.82;

/** Tope de entrada. Una foto de celular ronda los 3-6 MB. */
export const TAMANO_MAXIMO_ENTRADA = 12 * 1024 * 1024;

/**
 * Tope de salida: es el `file_size_limit` de los buckets de fotos
 * (ver infra/supabase/01-storage.sql). Se comprueba acá para poder avisar con
 * un mensaje entendible en vez de dejar que Storage devuelva un 413 en inglés.
 */
export const TAMANO_MAXIMO_SALIDA = 3 * 1024 * 1024;

/** Lado más corto mínimo. Menos que esto se ve borroso en la galería. */
export const LADO_MINIMO = 200;

export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/**
 * Extensiones que se aceptan al elegir el archivo.
 *
 * Se valida la extensión ADEMÁS del tipo MIME, no en lugar de él, porque ninguno
 * de los dos alcanza solo:
 *
 *   - El `accept` del `<input type="file">` es una sugerencia del navegador: en
 *     el diálogo se puede elegir "todos los archivos" y mandar cualquier cosa.
 *   - El tipo MIME lo deduce el navegador de la extensión, así que un archivo
 *     renombrado a `.jpg` llega como `image/jpeg` igual.
 *   - Y con HEIC varios navegadores no ponen ningún tipo, así que exigir solo
 *     el MIME rechazaría fotos de iPhone perfectamente válidas.
 *
 * La validación de verdad es que el archivo se pueda DECODIFICAR como imagen:
 * eso lo hace `cargarImagen` más abajo y es lo que ningún renombre engaña. Lo de
 * acá es para cortar temprano y con un mensaje claro.
 */
export const EXTENSIONES_ACEPTADAS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

/** Para el atributo `accept` del input, así el diálogo ya filtra. */
export const ACEPTA_INPUT = [...TIPOS_ACEPTADOS, ...EXTENSIONES_ACEPTADAS.map((e) => `.${e}`)].join(
  ',',
);

/**
 * Revisa el archivo elegido antes de tocarlo.
 *
 * Devuelve el mensaje del problema, o `null` si está todo bien.
 */
export function problemaDelArchivo(archivo: File): string | null {
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';

  if (!EXTENSIONES_ACEPTADAS.includes(extension)) {
    return `El archivo tiene que ser una foto ${EXTENSIONES_ACEPTADAS.join(', ').toUpperCase()}. "${archivo.name}" no lo es.`;
  }

  // Si el navegador sí dedujo un tipo, tiene que ser de imagen. Esto agarra el
  // caso de un archivo llamado `informe.pdf.jpg`.
  if (archivo.type !== '' && !archivo.type.startsWith('image/')) {
    return `"${archivo.name}" no es una imagen (el navegador lo reconoce como ${archivo.type}).`;
  }

  if (archivo.size === 0) {
    return 'El archivo está vacío.';
  }

  if (archivo.size > TAMANO_MAXIMO_ENTRADA) {
    return `La imagen pesa ${enMb(archivo.size)} y el máximo son ${enMb(TAMANO_MAXIMO_ENTRADA)}.`;
  }

  return null;
}

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
  const problema = problemaDelArchivo(archivo);
  if (problema) throw new Error(problema);

  const bitmap = await cargarImagen(archivo);

  if (Math.min(bitmap.width, bitmap.height) < LADO_MINIMO) {
    throw new Error(
      `La imagen es muy chica (${bitmap.width}x${bitmap.height}). El lado más corto tiene que tener al menos ${LADO_MINIMO} px.`,
    );
  }

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

  // No debería pasar con 1000 px de lado y calidad 0.82, pero si pasara, el
  // bucket rechazaría la subida con un error mucho menos claro que este.
  if (blob.size > TAMANO_MAXIMO_SALIDA) {
    throw new Error(
      `Aun reducida, la imagen pesa ${enMb(blob.size)} y el máximo son ${enMb(TAMANO_MAXIMO_SALIDA)}. Probá con otra foto.`,
    );
  }

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

/** Para los mensajes de error, donde hablar de megas se entiende mejor. */
export function enMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
