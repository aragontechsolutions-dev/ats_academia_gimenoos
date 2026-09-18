/**
 * Formas de los datos que consume la PWA.
 *
 * Es un subconjunto de lo que devuelve la API: el alumno solo accede a sus
 * propias clases y a su ficha.
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
  observaciones: string | null;
  motivoCancelacion: string | null;
  instructor: { id: string; nombre: string; apellido: string };
  vehiculo: { patente: string; tipo: TipoVehiculo } | null;
}

export interface Hueco {
  inicio: string;
  fin: string;
  instructorId: string;
  instructorNombre: string;
  vehiculoId: string;
  vehiculoPatente: string;
}

export interface Pack {
  id: string;
  clasesTotales: number;
  clasesUsadas: number;
  vigenteHasta: string | null;
  servicio: { nombre: string; tipoVehiculo: TipoVehiculo | null; duracionMin: number };
}

export interface MiFicha {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  ciudad: string;
  tipoDocumento: 'CEDULA' | 'PASAPORTE';
  paisDocumento: string;
  documento: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  /** Si quiere seguir recibiendo los recordatorios de clase por correo. */
  recibeAvisosPorCorreo: boolean;
  compras: Pack[];
}

export interface ConfiguracionPublica {
  nombre: string;
  direccion: string;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  antelacionMinimaHoras: number;
  cancelacionMinimaHoras: number;
}

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'A confirmar',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Dictada',
  CANCELADA: 'Cancelada',
  AUSENTE: 'No asististe',
};

export const COLOR_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-900',
  // Celeste y no el rojo de la marca: el rojo queda reservado para AUSENTE, que
  // es el único estado que el alumno tiene que leer como un problema. Con la
  // marca en rojo, "confirmada" y "faltó" se verían casi iguales.
  CONFIRMADA: 'bg-sky-100 text-sky-900',
  COMPLETADA: 'bg-green-100 text-green-900',
  CANCELADA: 'bg-slate-100 text-slate-500',
  AUSENTE: 'bg-red-100 text-red-900',
};

/** Estados en los que la clase sigue en pie y se puede cancelar. */
export const ESTADOS_VIGENTES: EstadoReserva[] = ['PENDIENTE', 'CONFIRMADA'];
