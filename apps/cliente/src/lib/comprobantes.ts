import { supabase } from './supabase';

/** Lo que acepta el bucket `comprobantes` (ver `infra/supabase/01-storage.sql`). */
const TIPOS = {
  'application/pdf': { extension: 'pdf', esImagen: false },
  'image/jpeg': { extension: 'jpg', esImagen: true },
  'image/png': { extension: 'png', esImagen: true },
} as const;

type TipoCanonico = keyof typeof TIPOS;

/**
 * Lo que manda un teléfono cuando el tipo no viene, o viene mal escrito.
 *
 * No es teoría: varios selectores de archivos de Android entregan el archivo con
 * `type` vacío, y algunos escriben `image/jpg`, que no existe como tipo MIME.
 * Cuando eso pasaba, el comprobante se rechazaba con un mensaje que hablaba de
 * PDF e imágenes mientras la persona **estaba** eligiendo una imagen.
 */
const POR_EXTENSION: Record<string, TipoCanonico> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const ALIAS: Record<string, TipoCanonico> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

/** Los que manda un iPhone y no entiende ni el bucket ni un navegador de escritorio. */
const DE_IPHONE = ['image/heic', 'image/heif'];

/** 5 MB, el límite del bucket. Se comprueba acá para no subir y fallar después. */
const PESO_MAXIMO = 5 * 1024 * 1024;

/**
 * Lado más largo al que se achica una imagen **que no entra**.
 *
 * 2200 px es generoso a propósito: tiene que quedar legible el número de
 * transacción, que es el único dato por el que existe el comprobante. Una foto
 * de celular de 12 MP se va a 2200 px sin que se note en pantalla.
 */
const LADO_MAXIMO = 2200;

/** Calidad del JPEG al achicar. Alta: esto se lee, no se mira. */
const CALIDAD = 0.9;

export const ACEPTA_INPUT = 'application/pdf,image/jpeg,image/png';

export interface ComprobanteSubido {
  archivo: string;
  /** Si hubo que achicar la imagen porque no entraba. La pantalla lo dice. */
  seAchico: boolean;
}

/**
 * Qué tipo de archivo es, mirando primero lo que dice el navegador y después el
 * nombre.
 *
 * El orden importa: el tipo declarado es más confiable que una extensión, que
 * cualquiera puede escribir a mano. Pero cuando no hay tipo declarado, la
 * extensión es lo único que queda, y negarse ahí es negarse a recibir el
 * comprobante de medio Android.
 */
function tipoDe(archivo: File): TipoCanonico | 'iphone' | null {
  const declarado = archivo.type.toLowerCase().trim();

  if (declarado in TIPOS) return declarado as TipoCanonico;
  if (declarado in ALIAS) return ALIAS[declarado]!;
  if (DE_IPHONE.includes(declarado)) return 'iphone';

  const extension = archivo.name.toLowerCase().split('.').pop() ?? '';
  if (extension === 'heic' || extension === 'heif') return 'iphone';
  return POR_EXTENSION[extension] ?? null;
}

const enMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Sube el comprobante de un pago al bucket privado.
 *
 * Va directo del navegador a Storage y no a través de la API: son varios
 * megabytes que no tienen por qué atravesar el servidor. La política del bucket
 * exige que el primer segmento de la ruta sea el id de quien sube, así que
 * nadie puede escribir en la carpeta de otro aunque quiera.
 *
 * **La imagen no se re-codifica si entra.** Un comprobante es un documento:
 * recomprimirlo puede dejar ilegible un número de transacción, y quien lo revisa
 * necesita leerlo. Sólo se toca cuando pasa de 5 MB, porque la alternativa no es
 * «subirla tal cual» sino «no poder pagar»: una foto sacada con la cámara del
 * teléfono pasa los 5 MB casi siempre.
 */
export async function subirComprobante(
  usuarioId: string,
  pagoId: string,
  original: File,
): Promise<ComprobanteSubido> {
  const tipo = tipoDe(original);

  if (tipo === 'iphone') {
    throw new Error(
      'Ese formato de foto del iPhone no lo podemos leer. En Ajustes → Cámara → Formatos, elegí «Más compatible», o mandá una captura de pantalla.',
    );
  }
  if (!tipo) {
    throw new Error('El comprobante tiene que ser un PDF o una imagen (jpg o png).');
  }

  let archivo: Blob = original;
  let seAchico = false;

  if (original.size > PESO_MAXIMO) {
    if (!TIPOS[tipo].esImagen) {
      throw new Error(
        `El PDF pesa ${enMb(original.size)} y el máximo son ${enMb(PESO_MAXIMO)}. Probá con una captura de pantalla.`,
      );
    }
    archivo = await achicar(original);
    seAchico = true;

    if (archivo.size > PESO_MAXIMO) {
      throw new Error(
        `Aun reducida, la imagen pesa ${enMb(archivo.size)}. Probá con una captura de pantalla en vez de una foto.`,
      );
    }
  }

  // Al achicar siempre sale un JPEG, sea cual sea el original.
  const salida: TipoCanonico = seAchico ? 'image/jpeg' : tipo;

  // El nombre lo pone el navegador y no la persona: el del archivo original
  // puede traer acentos, espacios y hasta el nombre de quien lo descargó.
  const nombre = `comprobante-${Date.now()}.${TIPOS[salida].extension}`;

  const { error } = await supabase.storage
    .from('comprobantes')
    .upload(`${usuarioId}/${pagoId}/${nombre}`, archivo, {
      // Explícito y no `archivo.type`: cuando el selector del teléfono no
      // declara tipo, subir con el tipo vacío lo rechaza el bucket.
      contentType: salida,
      upsert: false,
    });

  if (error) throw new Error(traducir(error.message));
  return { archivo: nombre, seAchico };
}

/**
 * Redibuja la imagen más chica.
 *
 * `createImageBitmap` con `imageOrientation: 'from-image'` aplica la rotación
 * del EXIF. Sin eso, la foto vertical de un comprobante se sube acostada: la
 * cámara guarda los píxeles apaisados y deja la rotación en los metadatos, que
 * es justo lo que este proceso descarta.
 */
async function achicar(archivo: File): Promise<Blob> {
  const imagen = await cargar(archivo);
  const anchoOriginal = 'width' in imagen ? imagen.width : 0;
  const altoOriginal = 'height' in imagen ? imagen.height : 0;

  const escala = Math.min(1, LADO_MAXIMO / Math.max(anchoOriginal, altoOriginal));
  const ancho = Math.round(anchoOriginal * escala);
  const alto = Math.round(altoOriginal * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo procesar la imagen.');

  // Fondo blanco: un PNG con transparencia, al pasar a JPEG, queda negro.
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', CALIDAD),
  );
  if (!blob) throw new Error('No se pudo procesar la imagen. Probá con una captura de pantalla.');
  return blob;
}

async function cargar(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch {
      // Algunos navegadores no admiten la opción; se sigue por el camino largo.
    }
  }

  const url = URL.createObjectURL(archivo);
  try {
    return await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const imagen = new Image();
      imagen.onload = () => resolver(imagen);
      imagen.onerror = () => rechazar(new Error('El archivo no es una imagen que podamos leer.'));
      imagen.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Los errores de Storage vienen en inglés y no se le pueden mostrar a nadie. */
function traducir(mensaje: string): string {
  if (/exceeded the maximum allowed size/i.test(mensaje)) {
    return 'El archivo pesa más de lo permitido. Probá con una captura o con el PDF del banco.';
  }
  if (/mime type.*not supported/i.test(mensaje)) {
    return 'Ese tipo de archivo no se acepta. Tiene que ser un PDF o una imagen (jpg o png).';
  }
  if (/already exists/i.test(mensaje)) {
    return 'Ese comprobante ya se había subido. Probá de nuevo.';
  }
  return 'No se pudo subir el comprobante. Probá de nuevo en un momento.';
}
