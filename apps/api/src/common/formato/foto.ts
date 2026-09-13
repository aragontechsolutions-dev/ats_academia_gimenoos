/**
 * Validación de las rutas de foto que guarda la base.
 *
 * Las fotos NO pasan por la API: el panel las sube directo a Supabase Storage y
 * después manda acá la ruta donde quedaron. Eso significa que la ruta es un dato
 * que llega de afuera y que después se usa para armar la dirección que publica
 * el sitio, así que se valida con una forma exacta y no con "que sea texto".
 *
 * Sin esta validación, quien tuviera acceso al panel podría guardar como foto:
 *
 *   - `https://otro-servidor.com/imagen.jpg` — una imagen servida desde
 *     cualquier lado, o un rastreador, mostrada como si fuera del sitio;
 *   - `javascript:...` — según dónde se pegue esa "ruta", código en la página;
 *   - `../../expedientes/<id>/cedula.jpg` — un archivo de otro bucket, uno de
 *     los privados, publicado sin querer;
 *   - `algo.svg` o `algo.html` — un SVG puede traer scripts adentro y se serviría
 *     desde el dominio del proyecto.
 *
 * La forma aceptada es `<uuid>/<archivo>.<jpg|jpeg|webp>`: el primer segmento es
 * el id del dueño de la foto (el egresado o el vehículo), que es la convención
 * de carpetas del bucket.
 */
import { applyDecorators } from '@nestjs/common';
import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

/** Extensiones que aceptan los buckets de fotos. Coincide con `allowed_mime_types`. */
export const EXTENSIONES_FOTO = ['jpg', 'jpeg', 'webp'] as const;

/** `<uuid>/<archivo>.<extensión>`, todo en minúsculas y sin subcarpetas. */
export const RUTA_FOTO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9._-]{1,80}\.(jpg|jpeg|webp)$/;

/**
 * Declara un campo de ruta de foto opcional, ya validado.
 *
 * `dueño` solo cambia el mensaje de error, para que diga "<id del vehículo>" o
 * "<id del egresado>" según el módulo.
 *
 * El `ValidateIf` deja pasar `null` y `''` sin correr el resto: son la forma de
 * pedir que se quite la foto, no una ruta mal escrita.
 */
export function EsRutaDeFoto(dueno: string) {
  return applyDecorators(
    IsOptional(),
    ValidateIf((_objeto: unknown, valor: unknown) => valor !== null && valor !== ''),
    IsString(),
    Length(0, 200),
    Matches(RUTA_FOTO, {
      message: `La ruta de la foto no tiene la forma esperada (<id ${dueno}>/<archivo>.jpg)`,
    }),
  );
}

/**
 * Traduce lo que manda el panel a lo que guarda la base.
 *
 * `undefined` (el campo no vino) deja el valor como está; `''` o `null` (se pidió
 * quitar la foto) lo borran.
 */
export function rutaFotoONula(valor: string | null | undefined): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}
