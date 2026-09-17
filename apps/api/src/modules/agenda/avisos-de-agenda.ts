import { DateTime } from 'luxon';
import { EstadoReserva } from '@prisma/client';

import { escaparHtml } from '../../common/telegram/telegram.service';

const ZONA = 'America/Montevideo';

/**
 * Lo mínimo de una clase que hace falta para redactar un aviso.
 *
 * Es un tipo propio y no el de Prisma a propósito: deja escrito, en un solo
 * lugar, **qué datos de una persona salen del sistema hacia Telegram**. Hoy son
 * el nombre y el apellido del alumno y del instructor, y nada más: ni cédula,
 * ni teléfono, ni correo. Ampliar esto es una decisión, no un descuido.
 */
export interface ClaseParaAvisar {
  inicio: Date;
  cliente: { nombre: string; apellido: string };
  instructor: { nombre: string; apellido: string };
}

/** «mar 17/09 a las 14:00», en hora de Uruguay. */
function cuando(inicio: Date): string {
  return DateTime.fromJSDate(inicio)
    .setZone(ZONA)
    .setLocale('es')
    .toFormat("ccc dd/LL 'a las' HH:mm");
}

/** Las dos líneas que llevan todos los avisos de clase. */
function cuerpo(clase: ClaseParaAvisar): string {
  const alumno = `${clase.cliente.nombre} ${clase.cliente.apellido}`;
  const instructor = `${clase.instructor.nombre} ${clase.instructor.apellido}`;
  return (
    `Alumno: ${escaparHtml(alumno)}\n` +
    `Cuándo: ${escaparHtml(cuando(clase.inicio))}\n` +
    `Instructor: ${escaparHtml(instructor)}`
  );
}

/**
 * Una clase nueva.
 *
 * Distingue quién la agendó porque cambia lo que hay que hacer: la que agenda el
 * alumno queda pendiente y alguien la tiene que confirmar; la que agenda la
 * academia ya está confirmada y no espera a nadie.
 */
export function avisoDeReservaNueva(clase: ClaseParaAvisar, laAgendoElAlumno: boolean): string {
  return (
    `<b>Nueva clase agendada</b>\n${cuerpo(clase)}\n` +
    (laAgendoElAlumno
      ? 'La agendó el alumno desde su app: queda pendiente de confirmar.'
      : 'Agendada desde el panel, ya confirmada.')
  );
}

/**
 * Una clase que se cerró.
 *
 * Devuelve null para los estados que no son un cierre. `CONFIRMADA` es el caso:
 * es movimiento interno de la academia y avisarlo sería ruido sobre algo que
 * quien recibe el aviso acaba de hacer.
 */
export function avisoDeCierre(clase: ClaseParaAvisar, estado: EstadoReserva): string | null {
  if (estado === EstadoReserva.COMPLETADA) {
    return `<b>Clase dictada</b>\n${cuerpo(clase)}`;
  }
  if (estado === EstadoReserva.AUSENTE) {
    return `<b>El alumno no vino a la clase</b>\n${cuerpo(clase)}`;
  }
  return null;
}

/** Una clase cancelada, con el motivo si lo hay. */
export function avisoDeCancelacion(clase: ClaseParaAvisar, motivo: string | null): string {
  const explicacion = motivo?.trim()
    ? `\nMotivo: ${escaparHtml(motivo.trim())}`
    : '\nSin motivo anotado.';
  return `<b>Clase cancelada</b>\n${cuerpo(clase)}${explicacion}`;
}
