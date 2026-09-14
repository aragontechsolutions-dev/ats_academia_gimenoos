/**
 * Formas de los datos que consume la app del instructor.
 *
 * Es un subconjunto de lo que devuelve la API. Lo que no está declarado acá no
 * es que se oculte: es que la API no se lo manda a este rol. La ficha del alumno
 * que ve un instructor, por ejemplo, no trae documento ni fecha de nacimiento.
 */

export type TipoVehiculo = 'MOTO' | 'AUTO';
export type EstadoReserva = 'PENDIENTE' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA' | 'AUSENTE';

export interface Reserva {
  id: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  tipo: TipoVehiculo;
  lugarEncuentro: string | null;
  /** Indicación de la academia para esta clase. El alumno también la ve. */
  observaciones: string | null;
  /** Cómo fue la clase, escrito por el instructor. El alumno NO la recibe. */
  notaInstructor: string | null;
  motivoCancelacion: string | null;
  /**
   * El alumno de la clase. Es lo primero que necesita ver el instructor.
   *
   * Sin el correo a propósito: la API lo manda, pero esta app no escribe correos
   * —contacta por teléfono o WhatsApp— y declarar un dato personal que no se usa
   * invita a usarlo sin pensarlo.
   */
  cliente: {
    id: string;
    nombre: string;
    apellido: string;
    telefono: string | null;
  };
  vehiculo: { id: string; patente: string; tipo: TipoVehiculo } | null;
}

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'A confirmar',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Dictada',
  CANCELADA: 'Cancelada',
  // Desde el lado del instructor la clase no es "no asististe" sino un dato del
  // alumno: quien lee esta pantalla no es quien faltó.
  AUSENTE: 'Faltó',
};

export const COLOR_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-900',
  // Celeste y no el rojo de la marca: el rojo queda para AUSENTE, que es el
  // único estado que hay que leer como un problema. Con la marca en rojo,
  // "confirmada" y "faltó" se verían casi iguales.
  CONFIRMADA: 'bg-sky-100 text-sky-900',
  COMPLETADA: 'bg-green-100 text-green-900',
  CANCELADA: 'bg-slate-200 text-slate-700',
  AUSENTE: 'bg-red-100 text-red-900',
};

/** Clases que todavía van a ocurrir o están ocurriendo. */
export const ESTADOS_VIGENTES: EstadoReserva[] = ['PENDIENTE', 'CONFIRMADA'];
