/**
 * Los importes viajan como enteros en centesimos (1 peso = 100) para evitar
 * errores de punto flotante. En la base se guardan como Decimal(12,2).
 */
export type Centesimos = number;

export function aCentesimos(pesos: number): Centesimos {
  return Math.round(pesos * 100);
}

export function aPesos(centesimos: Centesimos): number {
  return centesimos / 100;
}

export function formatearPesos(centesimos: Centesimos): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(aPesos(centesimos));
}
