import { supabase } from './supabase';
import { prepararFoto, type ImagenPreparada } from './imagen';

/**
 * Buckets de fotos del panel.
 *
 * Los dos funcionan igual —públicos para leer, solo administrador para
 * escribir— y usan la misma convención de rutas: `<id del dueño>/<archivo>.jpg`.
 * La API valida esa forma exacta antes de guardarla (ver
 * `apps/api/src/common/formato/foto.ts`).
 */
export type BucketFoto = 'graduados' | 'vehiculos';

export interface ResultadoSubida {
  ruta: string;
  imagen: ImagenPreparada;
}

/**
 * Sube una foto al bucket que corresponda.
 *
 * Va directo del navegador a Storage, con la sesión del administrador, en vez de
 * pasar por la API: son varios megabytes que no tienen por qué atravesar el
 * servidor, y las políticas del bucket ya exigen rol de administrador para
 * escribir.
 *
 * La imagen se valida, se reduce y se re-codifica ANTES de salir del navegador,
 * lo que además le quita los metadatos —incluida la ubicación GPS de la cámara—.
 * Ver `imagen.ts`.
 */
export async function subirFoto(
  bucket: BucketFoto,
  duenoId: string,
  archivo: File,
): Promise<ResultadoSubida> {
  const imagen = await prepararFoto(archivo);

  // El nombre lleva la marca de tiempo para que reemplazar una foto no quede
  // servida desde la caché del navegador con la imagen vieja.
  const ruta = `${duenoId}/foto-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(bucket).upload(ruta, imagen.archivo, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) throw new Error(traducirError(error.message));
  return { ruta, imagen };
}

/**
 * Borra la foto del Storage.
 *
 * Se usa al reemplazar una foto y al sacarla del sistema. Si alguien pide que
 * saquen su imagen, tiene que salir del Storage y no solo dejar de mostrarse.
 */
export async function borrarFoto(bucket: BucketFoto, ruta: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([ruta]);
  // Un archivo que ya no está no es un problema: el objetivo era que no esté.
  if (error && !/not found/i.test(error.message)) {
    throw new Error(traducirError(error.message));
  }
}

/** Dirección pública de una foto ya subida. */
export function urlFoto(bucket: BucketFoto, ruta: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${ruta}`;
}

/** Mensajes de Storage en inglés que conviene traducir para quien atiende. */
function traducirError(mensaje: string): string {
  if (/exceeded the maximum allowed size|payload too large/i.test(mensaje)) {
    return 'La imagen pesa más de lo que permite el servidor. Probá con otra foto.';
  }
  if (/mime type|not supported/i.test(mensaje)) {
    return 'Ese tipo de archivo no está permitido. Tiene que ser una foto JPG o WEBP.';
  }
  if (/new row violates row-level security|not authorized|403/i.test(mensaje)) {
    return 'Tu cuenta no tiene permiso para subir fotos. Tiene que ser una cuenta de administrador.';
  }
  if (/bucket not found/i.test(mensaje)) {
    return 'Falta crear el bucket de fotos en Supabase. Ver infra/supabase/01-storage.sql.';
  }
  // "Failed to fetch" es lo que devuelve el navegador cuando no llega al
  // servidor. Es el fallo más probable de todos —se corta internet a mitad de
  // una subida— y en inglés no le dice nada a quien atiende el mostrador.
  if (/failed to fetch|networkerror|load failed/i.test(mensaje)) {
    return 'No se pudo conectar para subir la foto. Revisá la conexión y probá de nuevo.';
  }
  return `No se pudo subir la foto: ${mensaje}`;
}
