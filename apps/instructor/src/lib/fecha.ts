import { DateTime, Settings } from 'luxon';

/**
 * Zona horaria de la academia.
 *
 * La API entrega y recibe siempre UTC. Acá se convierte a hora local para
 * mostrar y se vuelve a UTC para enviar. Fijar la zona por defecto evita que la
 * app muestre horarios distintos según dónde esté el teléfono que la abre, que
 * en la frontera con Brasil no es un caso hipotético.
 */
export const ZONA = 'America/Montevideo';
Settings.defaultZone = ZONA;
Settings.defaultLocale = 'es-UY';

const aLocal = (fecha: string | Date): DateTime =>
  typeof fecha === 'string'
    ? DateTime.fromISO(fecha, { zone: ZONA })
    : DateTime.fromJSDate(fecha).setZone(ZONA);

export const hora = (fecha: string | Date): string => aLocal(fecha).toFormat('HH:mm');

/**
 * "Miércoles 23 de setiembre".
 *
 * En español los días y los meses van en minúscula, salvo al empezar la frase.
 * La clase `capitalize` de CSS daría "Miércoles 23 De Setiembre", y algunas
 * versiones de los datos de idioma ya devuelven el mes capitalizado, así que se
 * normaliza a minúsculas antes de levantar la primera letra.
 */
export const soloPrimeraMayuscula = (texto: string): string => {
  const minusculas = texto.toLocaleLowerCase('es-UY');
  return minusculas.charAt(0).toLocaleUpperCase('es-UY') + minusculas.slice(1);
};
