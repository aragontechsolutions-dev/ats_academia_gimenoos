import { TipoRecordatorio } from '@prisma/client';

/** Cuánta antelación tiene cada recordatorio. */
export const ANTELACION_HORAS: Record<TipoRecordatorio, number> = {
  [TipoRecordatorio.VEINTICUATRO_HORAS]: 24,
  [TipoRecordatorio.DOS_HORAS]: 2,
};

/**
 * Si corresponde mandar este recordatorio, para esta clase, ahora.
 *
 * Son tres condiciones, y la tercera es la que no es obvia.
 *
 * 1. **La ventana está abierta**: falta menos que la antelación del
 *    recordatorio. A 25 horas de la clase, el de 24 todavía no toca.
 * 2. **La clase no empezó**. Si el disparador estuvo caído medio día, al volver
 *    no tiene que mandar recordatorios de clases que ya pasaron.
 * 3. **La reserva existía cuando la ventana se abrió.** Sin esto, alguien que
 *    reserva para dentro de tres horas recibe el recordatorio de 24 horas en el
 *    acto —la ventana ya estaba abierta cuando reservó—, que es un aviso sobre
 *    algo que acaba de hacer. Quien reserva con menos antelación que el
 *    recordatorio simplemente no recibe ese recordatorio, y está bien: no hace
 *    falta recordarle lo que decidió hace un rato.
 */
export function correspondeMandar(
  reserva: { inicio: Date; createdAt: Date },
  tipo: TipoRecordatorio,
  ahora: Date,
): boolean {
  const ventanaMs = ANTELACION_HORAS[tipo] * 60 * 60 * 1000;
  const seAbre = new Date(reserva.inicio.getTime() - ventanaMs);

  if (ahora < seAbre) return false;
  if (ahora >= reserva.inicio) return false;
  return reserva.createdAt <= seAbre;
}
