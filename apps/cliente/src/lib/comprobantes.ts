import { supabase } from './supabase';

/** Lo que acepta el bucket `comprobantes` (ver `infra/supabase/01-storage.sql`). */
const TIPOS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const;

/** 5 MB, el límite del bucket. Se comprueba acá para no subir y fallar después. */
const PESO_MAXIMO = 5 * 1024 * 1024;

export const ACEPTA_INPUT = 'application/pdf,image/jpeg,image/png';

/**
 * Sube el comprobante de un pago al bucket privado.
 *
 * Va directo del navegador a Storage y no a través de la API: son varios
 * megabytes que no tienen por qué atravesar el servidor. La política del bucket
 * exige que el primer segmento de la ruta sea el id de quien sube, así que
 * nadie puede escribir en la carpeta de otro aunque quiera.
 *
 * **La imagen NO se re-codifica**, al revés que las fotos del panel. Un
 * comprobante es un documento: recomprimirlo puede dejar ilegible un número de
 * transacción, y quien lo revisa necesita leerlo. Por eso tampoco se le quitan
 * los metadatos: no es una foto sacada con el teléfono en un lugar, es una
 * captura o un PDF del banco.
 */
export async function subirComprobante(
  usuarioId: string,
  pagoId: string,
  archivo: File,
): Promise<{ archivo: string }> {
  const extension = TIPOS[archivo.type as keyof typeof TIPOS];
  if (!extension) {
    throw new Error('El comprobante tiene que ser un PDF o una imagen (jpg o png).');
  }
  if (archivo.size > PESO_MAXIMO) {
    throw new Error('El archivo pesa más de 5 MB. Probá con una captura o con el PDF del banco.');
  }

  // El nombre lo pone el navegador y no la persona: el del archivo original
  // puede traer acentos, espacios y hasta el nombre de quien lo descargó.
  const nombre = `comprobante-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from('comprobantes')
    .upload(`${usuarioId}/${pagoId}/${nombre}`, archivo, {
      contentType: archivo.type,
      upsert: false,
    });

  if (error) throw new Error(traducir(error.message));
  return { archivo: nombre };
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
