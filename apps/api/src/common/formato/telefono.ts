import { BadRequestException } from '@nestjs/common';

/** Código de país de Uruguay, sin el signo. */
const URUGUAY = '598';

/**
 * Deja el teléfono en un formato único: `+598 98663201`.
 *
 * Se normaliza en el servidor y no en el formulario porque es una regla del
 * dato, no de la pantalla: el mismo número tiene que quedar igual entre por
 * donde entre —el panel, la app del alumno o una carga futura desde un archivo—.
 * Sin esto, el mismo alumno queda cargado como `098663201`, `098 663 201` y
 * `+59898663201`, y buscarlo por teléfono deja de funcionar.
 *
 * Qué acepta, todo para el mismo número:
 *
 * | Se escribe        | Se guarda        |
 * |-------------------|------------------|
 * | `098663201`       | `+598 98663201`  |
 * | `098 663 201`     | `+598 98663201`  |
 * | `98663201`        | `+598 98663201`  |
 * | `+598 98663201`   | `+598 98663201`  |
 * | `598 98663201`    | `+598 98663201`  |
 * | `(02) 4266 0000`  | `+598 42660000`  |
 *
 * Un número que ya viene con otro código de país (`+55 11 …`) se respeta: un
 * alumno extranjero puede tener su teléfono de origen, y forzarle un +598 lo
 * dejaría inutilizable.
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  if (entrada === undefined) return null;
  if (entrada === null) return null;

  const limpio = entrada.trim();
  if (limpio === '') return null;

  const teniaMas = limpio.startsWith('+');
  const digitos = limpio.replace(/\D/g, '');

  if (digitos === '') {
    throw new BadRequestException('El teléfono no tiene ningún número');
  }

  // Número extranjero explícito: se respeta tal cual, solo con los dígitos.
  if (teniaMas && !digitos.startsWith(URUGUAY)) {
    if (digitos.length < 6 || digitos.length > 15) {
      throw new BadRequestException('El teléfono internacional no tiene un largo válido');
    }
    return `+${digitos}`;
  }

  // A partir de acá es uruguayo: se le saca el código de país y el 0 de trunk,
  // que son dos formas de escribir lo mismo.
  let nacional = digitos;
  if (nacional.startsWith(URUGUAY)) nacional = nacional.slice(URUGUAY.length);
  if (nacional.startsWith('0')) nacional = nacional.replace(/^0+/, '');

  // En Uruguay todos los números son de 8 dígitos: los celulares empiezan con 9
  // y los fijos con 2 o 4.
  if (!/^\d{8}$/.test(nacional)) {
    throw new BadRequestException(
      `El teléfono tiene que ser un número uruguayo de 8 dígitos (por ejemplo 098663201 o 42660000). ` +
        `Si es de otro país, escribilo con su código: +55 11 99999 9999.`,
    );
  }

  return `+${URUGUAY} ${nacional}`;
}
