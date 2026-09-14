import { DateTime } from 'luxon';

import { ZONA, soloPrimeraMayuscula } from './fecha';
import type { Reserva } from './tipos';

/**
 * Las tres formas de mirar la misma agenda.
 *
 * No son tres pantallas sino tres recortes de una: se elige el recorte y el
 * resto de la app no cambia. Por eso el selector es un control segmentado
 * arriba y no una barra de navegación abajo, que prometería secciones distintas.
 */
export type Vista = 'dia' | 'semana' | 'mes';

export const VISTAS: { valor: Vista; etiqueta: string }[] = [
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
];

/**
 * Qué período pide cada vista.
 *
 * El mes arranca en el lunes anterior al día 1 y termina en el domingo
 * posterior al último: es la grilla completa del calendario, con los días de
 * relleno. Sin eso, la primera fila del mes aparecería con casilleros vacíos que
 * en realidad tienen clases.
 *
 * El caso más largo son 42 días, por debajo del tope de 62 que impone la API.
 */
export function rangoDe(vista: Vista, referencia: DateTime): { desde: DateTime; hasta: DateTime } {
  if (vista === 'dia') {
    return { desde: referencia.startOf('day'), hasta: referencia.endOf('day') };
  }
  if (vista === 'semana') {
    return { desde: referencia.startOf('week'), hasta: referencia.endOf('week') };
  }
  return {
    desde: referencia.startOf('month').startOf('week'),
    hasta: referencia.endOf('month').endOf('week'),
  };
}

/** Cuánto se mueve la flecha de «anterior» y «siguiente» en cada vista. */
export function paso(vista: Vista): { days?: number; weeks?: number; months?: number } {
  if (vista === 'dia') return { days: 1 };
  if (vista === 'semana') return { weeks: 1 };
  return { months: 1 };
}

/**
 * Cómo se nombra el período que se está mirando.
 *
 * El día cercano se nombra por su relación con hoy —«Hoy», «Mañana»— porque es
 * como lo piensa quien lo mira; un día lejano necesita la fecha.
 */
export function tituloDe(vista: Vista, referencia: DateTime, ahora: DateTime): string {
  if (vista === 'dia') {
    const diferencia = referencia.startOf('day').diff(ahora.startOf('day'), 'days').days;
    if (diferencia === 0) return 'Hoy';
    if (diferencia === 1) return 'Mañana';
    if (diferencia === -1) return 'Ayer';
    return soloPrimeraMayuscula(referencia.toFormat("cccc d 'de' LLLL"));
  }

  if (vista === 'semana') {
    const { desde, hasta } = rangoDe('semana', referencia);
    // En minúscula porque el mes cae a mitad de frase, y los datos de idioma lo
    // devuelven capitalizado. Con mayúscula se leía «14 al 20 de Setiembre».
    const mes = (fecha: DateTime, largo: boolean) =>
      fecha.toFormat(largo ? 'LLLL' : 'LLL').toLocaleLowerCase('es-UY');

    // Dentro del mismo mes no se repite el nombre del mes: «15 al 21 de
    // setiembre» en vez de «15 de setiembre al 21 de setiembre». Cuando la
    // semana cruza de mes se abrevia, para que entre en la barra del teléfono.
    return desde.hasSame(hasta, 'month')
      ? `${desde.toFormat('d')} al ${hasta.toFormat('d')} de ${mes(hasta, true)}`
      : `${desde.toFormat('d')} de ${mes(desde, false)} al ${hasta.toFormat('d')} de ${mes(hasta, false)}`;
  }

  return soloPrimeraMayuscula(referencia.toFormat('LLLL yyyy'));
}

/** El subtítulo de la barra: la fecha exacta, que el título no siempre dice. */
export function subtituloDe(vista: Vista, referencia: DateTime): string {
  if (vista === 'dia') return referencia.toFormat('dd/LL/yyyy');
  if (vista === 'semana') return referencia.toFormat('LLLL yyyy');
  return '';
}

/**
 * Se queda con las clases que **empiezan** dentro del período.
 *
 * Hace falta porque la API filtra por solapamiento —devuelve toda clase que
 * pise el rango, aunque haya arrancado antes—, y eso es lo correcto para la
 * grilla del panel: una clase de 23:30 a 00:15 tiene que dibujarse en los dos
 * días que ocupa.
 *
 * Acá no. Esta app lista clases, no las dibuja sobre una línea de tiempo, y la
 * lista va ordenada por hora de inicio: sin este filtro, la clase de anoche
 * aparece **primera** bajo el título «Mañana», arriba de las de mañana. No es
 * un detalle estético: la primera tarjeta es la que se toca, y tocarla cierra o
 * cancela la clase equivocada. Pasó en la prueba de navegador antes de existir
 * este filtro.
 *
 * Una clase pertenece al día en que empieza, que es como la nombra cualquiera
 * que la dé.
 */
export function queEmpiezanEn(reservas: Reserva[], desde: DateTime, hasta: DateTime): Reserva[] {
  return reservas.filter((reserva) => {
    const inicio = DateTime.fromISO(reserva.inicio, { zone: ZONA });
    return inicio >= desde && inicio <= hasta;
  });
}

/**
 * Las reservas agrupadas por día, en orden y sin días vacíos.
 *
 * Se agrupa por la fecha local y no por la UTC que manda la API: una clase de
 * las 21:00 de Montevideo cae al día siguiente en UTC, y aparecería bajo el día
 * equivocado.
 */
export function porDia(reservas: Reserva[]): { dia: DateTime; reservas: Reserva[] }[] {
  const grupos = new Map<string, Reserva[]>();

  for (const reserva of reservas) {
    const clave = DateTime.fromISO(reserva.inicio, { zone: ZONA }).toISODate() ?? '';
    const existente = grupos.get(clave);
    if (existente) existente.push(reserva);
    else grupos.set(clave, [reserva]);
  }

  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, delDia]) => ({
      dia: DateTime.fromISO(clave, { zone: ZONA }),
      reservas: [...delDia].sort((a, b) => a.inicio.localeCompare(b.inicio)),
    }));
}

/** Los casilleros de la grilla del mes: seis semanas de lunes a domingo. */
export function casillerosDelMes(referencia: DateTime): DateTime[] {
  const { desde, hasta } = rangoDe('mes', referencia);
  const casilleros: DateTime[] = [];
  for (let dia = desde; dia <= hasta; dia = dia.plus({ days: 1 })) {
    casilleros.push(dia.startOf('day'));
  }
  return casilleros;
}
