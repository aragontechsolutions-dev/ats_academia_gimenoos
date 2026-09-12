/** Constantes de negocio compartidas por API y frontends. */

/** Toda fecha se persiste en UTC y se presenta al usuario en esta zona. */
export const ZONA_HORARIA = 'America/Montevideo';

export const MONEDA = 'UYU';
export const LOCALE = 'es-UY';

/** Buckets privados de Supabase Storage. Ninguno es publico. */
export const BUCKET_COMPROBANTES = 'comprobantes';
export const BUCKET_EXPEDIENTES = 'expedientes';

/**
 * La Intendencia de Maldonado exige documentos digitales de hasta 5 MB
 * en formato JPG, PNG o PDF. Se replica el limite en la validacion de subida.
 */
export const MAX_BYTES_DOCUMENTO = 5 * 1024 * 1024;
export const MIME_DOCUMENTOS_PERMITIDOS = ['image/jpeg', 'image/png', 'application/pdf'] as const;

/** Prefijo de todas las rutas de la API. */
export const API_PREFIX = 'api/v1';
