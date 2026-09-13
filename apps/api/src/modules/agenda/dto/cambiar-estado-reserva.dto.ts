import { IsIn } from 'class-validator';
import { EstadoReserva } from '@prisma/client';

/**
 * Estados a los que la academia puede mover una clase desde el panel.
 * CANCELADA no está: tiene su propio endpoint, porque además registra el motivo.
 */
export const ESTADOS_ASIGNABLES = [
  EstadoReserva.CONFIRMADA,
  EstadoReserva.COMPLETADA,
  EstadoReserva.AUSENTE,
] as const;

export type EstadoAsignable = (typeof ESTADOS_ASIGNABLES)[number];

export class CambiarEstadoReservaDto {
  @IsIn([...ESTADOS_ASIGNABLES])
  estado!: EstadoAsignable;
}
