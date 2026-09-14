import { DateTime, Settings } from 'luxon';

/**
 * Zona horaria de la academia.
 *
 * La API entrega y recibe siempre UTC. Acá se convierte a hora local para
 * mostrar y se vuelve a UTC para enviar. Fijar la zona por defecto evita que el
 * panel muestre horarios distintos según dónde esté la computadora que lo abre.
 */
export const ZONA = 'America/Montevideo';
Settings.defaultZone = ZONA;
Settings.defaultLocale = 'es-UY';

export const aLocal = (fecha: string | Date): DateTime =>
  typeof fecha === 'string' ? DateTime.fromISO(fecha, { zone: ZONA }) : DateTime.fromJSDate(fecha).setZone(ZONA);

export const hora = (fecha: string | Date): string => aLocal(fecha).toFormat('HH:mm');

export const fechaCorta = (fecha: string | Date): string => aLocal(fecha).toFormat('dd/LL/yyyy');

/**
 * "Miércoles 23 de setiembre".
 *
 * En español los días y los meses van en minúscula, salvo al empezar la frase.
 * La clase `capitalize` de CSS daría "Miércoles 23 De Setiembre", y algunas
 * versiones de los datos de idioma ya devuelven el mes capitalizado, así que se
 * normaliza a minúsculas antes de levantar la primera letra.
 */
export const fechaLarga = (fecha: string | Date): string =>
  soloPrimeraMayuscula(aLocal(fecha).toFormat("cccc d 'de' LLLL"));

export const soloPrimeraMayuscula = (texto: string): string => {
  const minusculas = texto.toLocaleLowerCase('es-UY');
  return minusculas.charAt(0).toLocaleUpperCase('es-UY') + minusculas.slice(1);
};

export const fechaYHora = (fecha: string | Date): string =>
  aLocal(fecha).toFormat("dd/LL/yyyy 'a las' HH:mm");

/** Minutos desde medianoche, para posicionar una clase en la grilla horaria. */
export const minutosDelDia = (fecha: string | Date): number => {
  const local = aLocal(fecha);
  return local.hour * 60 + local.minute;
};

export const duracionEnMinutos = (inicio: string | Date, fin: string | Date): number =>
  aLocal(fin).diff(aLocal(inicio), 'minutes').minutes;

/** Nombres de los días como los numera la base: 0 = domingo … 6 = sábado. */
export const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** "09:30" ↔ 570 minutos. Es el formato con el que se edita la plantilla. */
export const minutosAHHMM = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

export const hhmmAMinutos = (valor: string): number => {
  const [h, m] = valor.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
