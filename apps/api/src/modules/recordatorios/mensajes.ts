import { DateTime } from 'luxon';
import { TipoRecordatorio } from '@prisma/client';

import { escaparHtml } from '../../common/telegram/telegram.service';

const ZONA = 'America/Montevideo';

/** Lo mínimo de una clase que hace falta para redactar un recordatorio. */
export interface ClaseParaRecordar {
  inicio: Date;
  tipo: string;
  cliente: { nombre: string; apellido: string; telefono: string | null };
  instructor: { nombre: string; apellido: string };
}

/** Lo que ve el alumno en la notificación de su teléfono. */
export interface AvisoParaElAlumno {
  titulo: string;
  cuerpo: string;
  url: string;
}

/** «mañana a las 14:30» o «hoy a las 14:30», según el día de Uruguay. */
function cuando(inicio: Date, ahora: Date): string {
  const clase = DateTime.fromJSDate(inicio).setZone(ZONA);
  const hoy = DateTime.fromJSDate(ahora).setZone(ZONA);
  const dias = clase.startOf('day').diff(hoy.startOf('day'), 'days').days;
  const hora = clase.toFormat('HH:mm');

  if (dias === 0) return `hoy a las ${hora}`;
  if (dias === 1) return `mañana a las ${hora}`;
  return `el ${clase.setLocale('es').toFormat('ccc dd/LL')} a las ${hora}`;
}

/**
 * El recordatorio que le llega a la academia por Telegram.
 *
 * Lleva el teléfono del alumno, y es el único aviso que lo lleva. Tiene un
 * motivo concreto: este mensaje existe para que alguien pueda **llamarlo** si
 * hace falta, y sin el número hay que ir a buscarlo al panel, que es
 * exactamente el trabajo que este aviso viene a ahorrar.
 */
export function recordatorioParaLaAcademia(
  clase: ClaseParaRecordar,
  tipo: TipoRecordatorio,
  ahora: Date,
): string {
  const alumno = `${clase.cliente.nombre} ${clase.cliente.apellido}`;
  const instructor = `${clase.instructor.nombre} ${clase.instructor.apellido}`;
  const titulo =
    tipo === TipoRecordatorio.VEINTICUATRO_HORAS ? 'Clase mañana' : 'Clase en un rato';

  return (
    `<b>${titulo}</b>\n` +
    `${escaparHtml(alumno)} — clase de ${escaparHtml(clase.tipo.toLowerCase())} ` +
    `${escaparHtml(cuando(clase.inicio, ahora))}\n` +
    `Instructor: ${escaparHtml(instructor)}` +
    (clase.cliente.telefono ? `\nTeléfono: ${escaparHtml(clase.cliente.telefono)}` : '')
  );
}

/**
 * El recordatorio que le llega al ALUMNO a su teléfono.
 *
 * Es deliberadamente distinto del que recibe la academia, y más corto. Dos
 * motivos:
 *
 * - Una notificación se ve en la **pantalla bloqueada**, donde la puede leer
 *   cualquiera que tenga el teléfono en la mano. Por eso no lleva el teléfono
 *   del alumno ni nada que no sea la clase.
 * - El aviso de la academia contesta «¿a quién llamo?»; este contesta «¿cuándo
 *   tengo que estar?». Son dos preguntas distintas.
 *
 * Se tutea porque es la voz de toda la app del alumno.
 */
export function recordatorioParaElAlumno(
  clase: ClaseParaRecordar,
  tipo: TipoRecordatorio,
  ahora: Date,
): AvisoParaElAlumno {
  const instructor = `${clase.instructor.nombre} ${clase.instructor.apellido}`;
  const esManiana = tipo === TipoRecordatorio.VEINTICUATRO_HORAS;

  return {
    titulo: esManiana ? 'Tenés clase mañana' : 'Tu clase es en un rato',
    // Sin escapar: esto no es HTML, es texto que el navegador muestra tal cual.
    cuerpo:
      `Clase de ${clase.tipo.toLowerCase()} ${cuando(clase.inicio, ahora)}` +
      ` con ${instructor}.`,
    url: '/',
  };
}
