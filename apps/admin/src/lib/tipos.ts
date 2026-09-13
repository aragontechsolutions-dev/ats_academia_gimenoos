/**
 * Formas de los datos que devuelve la API.
 *
 * Se declaran a mano y no se generan porque son pocas y explícitas; si la API
 * cambia, el compilador no lo detecta solo, así que cualquier cambio de contrato
 * se refleja acá en el mismo commit.
 */

export type TipoVehiculo = 'MOTO' | 'AUTO';
export type EstadoVehiculo = 'ACTIVO' | 'MANTENIMIENTO' | 'BAJA';
export type EstadoReserva = 'PENDIENTE' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA' | 'AUSENTE';
export type TipoServicio = 'CLASE_SUELTA' | 'PACK' | 'CURSO_COMPLETO' | 'GESTORIA';
export type TipoExcepcion = 'BLOQUEO' | 'DISPONIBILIDAD_EXTRA';

export interface Franja {
  id?: string;
  diaSemana: number;
  minutoInicio: number;
  minutoFin: number;
}

export interface Excepcion {
  id: string;
  tipo: TipoExcepcion;
  inicio: string;
  fin: string;
  motivo: string | null;
}

export interface Instructor {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  habilitaMoto: boolean;
  habilitaAuto: boolean;
  activo: boolean;
  colorAgenda: string;
  disponibilidades?: Franja[];
  excepciones?: Excepcion[];
}

export interface Vehiculo {
  id: string;
  patente: string;
  tipo: TipoVehiculo;
  marca: string | null;
  modelo: string | null;
  cilindrada: number | null;
  anio: number | null;
  estado: EstadoVehiculo;
  soaVence: string | null;
}

export interface Servicio {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoServicio;
  tipoVehiculo: TipoVehiculo | null;
  cantidadClases: number;
  duracionMin: number;
  /** Prisma serializa Decimal como string para no perder precisión. */
  precioContado: string;
  precioTarjeta: string;
  activo: boolean;
  publico: boolean;
  orden: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  ciudad: string;
  activo: boolean;
  /** Solo llegan si quien consulta es administrador. */
  cedula?: string | null;
  fechaNacimiento?: string | null;
  direccion?: string | null;
  notasInternas?: string | null;
  usuarioId?: string | null;
}

export interface ReservaDelHistorial {
  id: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  tipo: TipoVehiculo;
  instructor: { id: string; nombre: string; apellido: string };
  vehiculo: { patente: string } | null;
}

export interface CompraDelHistorial {
  id: string;
  clasesTotales: number;
  clasesUsadas: number;
  vigenteHasta: string | null;
  servicio: { nombre: string; tipoVehiculo: TipoVehiculo | null; duracionMin: number };
}

export interface FichaCliente extends Cliente {
  reservas: ReservaDelHistorial[];
  compras: CompraDelHistorial[];
}

export interface Reserva {
  id: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  tipo: TipoVehiculo;
  lugarEncuentro: string | null;
  observaciones: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
  cliente: { id: string; nombre: string; apellido: string; telefono: string | null; email: string | null };
  instructor: { id: string; nombre: string; apellido: string; colorAgenda: string };
  vehiculo: { id: string; patente: string; tipo: TipoVehiculo } | null;
}

export interface Hueco {
  inicio: string;
  fin: string;
  instructorId: string;
  instructorNombre: string;
  vehiculoId: string;
  vehiculoPatente: string;
}

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Dictada',
  CANCELADA: 'Cancelada',
  AUSENTE: 'No asistió',
};

export const COLOR_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-300',
  CONFIRMADA: 'bg-marca-100 text-marca-900 border-marca-600',
  COMPLETADA: 'bg-green-100 text-green-800 border-green-300',
  CANCELADA: 'bg-slate-100 text-slate-500 border-slate-300 line-through',
  AUSENTE: 'bg-red-100 text-red-800 border-red-300',
};
