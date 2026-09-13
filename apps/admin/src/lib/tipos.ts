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
  /** Ruta de la foto dentro del bucket `vehiculos`, no una dirección completa. */
  fotoRuta: string | null;
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
  tipoDocumento?: 'CEDULA' | 'PASAPORTE';
  /** País emisor del pasaporte, ISO alfa-2. Para la cédula siempre UY. */
  paisDocumento?: string;
  documento?: string | null;
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

export type EstadoInvitacion = 'PENDIENTE' | 'ACEPTADA' | 'REVOCADA';

export interface Invitacion {
  id: string;
  email: string;
  rol: 'ADMIN' | 'INSTRUCTOR' | 'CLIENTE';
  estado: EstadoInvitacion;
  /** Null = la fila existe pero el correo no salió, y hay que reintentar. */
  enviadaAt: string | null;
  aceptadaAt: string | null;
  createdAt: string;
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

/**
 * Colores de la agenda.
 *
 * El rojo está reservado para AUSENTE, que es el único estado que señala un
 * problema. CONFIRMADA no usa el rojo de la marca aunque sea el color del
 * sistema: al pasar la paleta del panel de azul a rojo, una clase confirmada y
 * un alumno que no se presentó quedaban del mismo color, y son los dos
 * desenlaces más opuestos que puede tener una clase.
 */
export const COLOR_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-900 border-amber-400',
  CONFIRMADA: 'bg-sky-100 text-sky-900 border-sky-500',
  COMPLETADA: 'bg-green-100 text-green-900 border-green-500',
  CANCELADA: 'bg-slate-100 text-slate-500 border-slate-300 line-through',
  AUSENTE: 'bg-red-100 text-red-900 border-red-500',
};

// --- Sitio público ---------------------------------------------------------

export interface ItemSeccion {
  titulo: string;
  detalle?: string;
}

export interface SeccionLanding {
  clave: string;
  nombre: string;
  admiteItems: boolean;
  visible: boolean;
  orden: number;
  titulo: string | null;
  bajada: string | null;
  etiqueta: string | null;
  accion: string | null;
  items: ItemSeccion[];
  /** true si alguien ya guardó contenido propio para esta sección. */
  personalizada: boolean;
}

export interface NegocioLanding {
  nombre: string;
  direccion: string | null;
  ciudad: string;
  departamento: string;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  horarios: string | null;
  mapaUrl: string | null;
  instagram: string | null;
  facebook: string | null;
}

// --- Egresados y diplomas --------------------------------------------------

export type CategoriaLicencia = 'A' | 'G1' | 'G2' | 'G3';

export interface Graduado {
  id: string;
  clienteId: string;
  categoria: CategoriaLicencia;
  fechaEgreso: string;
  anio: number;
  /** Código de verificación impreso en el diploma. */
  codigo: string;
  autorizacionAt: string | null;
  autorizacionFirmante: string | null;
  autorizacionEsTutor: boolean;
  fotoRuta: string | null;
  publicado: boolean;
  notas: string | null;
  cliente: { id: string; nombre: string; apellido: string };
}
