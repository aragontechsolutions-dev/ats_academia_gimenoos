import { BadRequestException } from '@nestjs/common';

/**
 * Deja un correo en la forma en que se compara y se guarda.
 *
 * Todo en minúscula y sin espacios alrededor. No es cosmético: Supabase
 * normaliza los correos de sus cuentas, así que si acá se guardara
 * `Juan@Ejemplo.com` y el token trajera `juan@ejemplo.com`, la búsqueda no
 * encontraría nada y la invitación no serviría —sin ningún error visible, que es
 * la peor forma de fallar—.
 *
 * La misma regla la hace cumplir la base con un CHECK, para que no dependa de
 * que todos los caminos de código se acuerden de llamar a esta función.
 */
export function normalizarEmail(entrada: string | null | undefined): string | null {
  if (entrada === undefined || entrada === null) return null;
  const limpio = entrada.trim().toLowerCase();
  return limpio === '' ? null : limpio;
}

/** Igual que `normalizarEmail`, pero exige que haya uno. */
export function exigirEmail(entrada: string | null | undefined, motivo: string): string {
  const email = normalizarEmail(entrada);
  if (!email) throw new BadRequestException(motivo);
  return email;
}
