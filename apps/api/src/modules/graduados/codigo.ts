import { randomInt } from 'node:crypto';

/**
 * Alfabeto sin caracteres que se confunden al leerlos de un papel: no van 0/O,
 * 1/I/L ni 5/S. El código se dicta por teléfono y se tipea a mano; un cero
 * confundido con una O convierte un diploma válido en "no encontrado".
 *
 * Cada carácter aparece UNA sola vez: repetir uno lo haría más probable que el
 * resto y achicaría el espacio real de códigos sin que se note.
 */
const ALFABETO = '2346789ABCDEFGHJKMNPQRTUVWXYZ';
const LARGO = 8;

/**
 * Código de verificación del diploma.
 *
 * Aleatorio y no correlativo a propósito: con códigos secuenciales cualquiera
 * podría recorrer la lista completa de egresados desde afuera, que es
 * exactamente lo que este diseño busca evitar. Con este alfabeto y este largo
 * hay del orden de 10^11 combinaciones, así que adivinar uno no es una vía
 * práctica para enumerar a nadie.
 */
export function generarCodigo(): string {
  let codigo = '';
  for (let i = 0; i < LARGO; i += 1) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return codigo;
}

/** Normaliza lo que la persona tipea: mayúsculas y sin espacios ni guiones. */
export function normalizarCodigo(entrada: string): string {
  return entrada.trim().toUpperCase().replace(/[\s-]/g, '');
}
