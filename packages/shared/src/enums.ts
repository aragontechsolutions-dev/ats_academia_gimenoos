/**
 * Enums del dominio.
 *
 * IMPORTANTE: estos valores deben coincidir EXACTAMENTE con los enums definidos en
 * apps/api/prisma/schema.prisma. Si cambias uno, cambia el otro en la misma migracion.
 * Se declaran como objetos `as const` (y no como `enum` de TypeScript) para que puedan
 * consumirse desde los frontends sin requerir emision de codigo.
 */

export const RolUsuario = {
  ADMIN: 'ADMIN',
  INSTRUCTOR: 'INSTRUCTOR',
  CLIENTE: 'CLIENTE',
} as const;
export type RolUsuario = (typeof RolUsuario)[keyof typeof RolUsuario];

export const TipoVehiculo = {
  MOTO: 'MOTO',
  AUTO: 'AUTO',
} as const;
export type TipoVehiculo = (typeof TipoVehiculo)[keyof typeof TipoVehiculo];

/**
 * Categorias del Permiso Unico Nacional de Conducir relevantes para la academia.
 * A  = automovil particular (amateur)
 * G1 = ciclomotores hasta 50cc (desde 16 anios, con autorizacion de padres/tutor)
 * G2 = motocicletas con cambios hasta 200cc
 * G3 = motocicletas de mas de 200cc
 * Las categorias profesionales (B a F) quedan fuera del alcance inicial.
 */
export const CategoriaLicencia = {
  A: 'A',
  G1: 'G1',
  G2: 'G2',
  G3: 'G3',
} as const;
export type CategoriaLicencia = (typeof CategoriaLicencia)[keyof typeof CategoriaLicencia];

export const EstadoVehiculo = {
  ACTIVO: 'ACTIVO',
  MANTENIMIENTO: 'MANTENIMIENTO',
  BAJA: 'BAJA',
} as const;
export type EstadoVehiculo = (typeof EstadoVehiculo)[keyof typeof EstadoVehiculo];

export const TipoServicio = {
  CLASE_SUELTA: 'CLASE_SUELTA',
  PACK: 'PACK',
  CURSO_COMPLETO: 'CURSO_COMPLETO',
  GESTORIA: 'GESTORIA',
} as const;
export type TipoServicio = (typeof TipoServicio)[keyof typeof TipoServicio];

/**
 * Estados que ocupan agenda (bloquean instructor y vehiculo): PENDIENTE y CONFIRMADA.
 * El resto libera el horario. Esta regla esta replicada en la EXCLUDE constraint de Postgres.
 */
export const EstadoReserva = {
  PENDIENTE: 'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  COMPLETADA: 'COMPLETADA',
  CANCELADA: 'CANCELADA',
  AUSENTE: 'AUSENTE',
} as const;
export type EstadoReserva = (typeof EstadoReserva)[keyof typeof EstadoReserva];

export const ESTADOS_RESERVA_QUE_OCUPAN_AGENDA: readonly EstadoReserva[] = [
  EstadoReserva.PENDIENTE,
  EstadoReserva.CONFIRMADA,
] as const;

export const TipoExcepcion = {
  BLOQUEO: 'BLOQUEO',
  DISPONIBILIDAD_EXTRA: 'DISPONIBILIDAD_EXTRA',
} as const;
export type TipoExcepcion = (typeof TipoExcepcion)[keyof typeof TipoExcepcion];

export const CanalPago = {
  MP_ONLINE: 'MP_ONLINE',
  MP_POINT: 'MP_POINT',
  TRANSFERENCIA: 'TRANSFERENCIA',
  EFECTIVO: 'EFECTIVO',
} as const;
export type CanalPago = (typeof CanalPago)[keyof typeof CanalPago];

export const EstadoPago = {
  PENDIENTE: 'PENDIENTE',
  PENDIENTE_VERIFICACION: 'PENDIENTE_VERIFICACION',
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO',
  REEMBOLSADO: 'REEMBOLSADO',
} as const;
export type EstadoPago = (typeof EstadoPago)[keyof typeof EstadoPago];

/** Estados del tramite de libreta ante la Intendencia de Maldonado. */
export const EstadoExpediente = {
  INICIADO: 'INICIADO',
  DOCS_PENDIENTES: 'DOCS_PENDIENTES',
  MEDICO_OK: 'MEDICO_OK',
  CHARLA_OK: 'CHARLA_OK',
  TEORICO_APROBADO: 'TEORICO_APROBADO',
  PRACTICO_APROBADO: 'PRACTICO_APROBADO',
  EMITIDA: 'EMITIDA',
  RECHAZADO: 'RECHAZADO',
} as const;
export type EstadoExpediente = (typeof EstadoExpediente)[keyof typeof EstadoExpediente];

export const TipoDocumento = {
  CEDULA: 'CEDULA',
  CONSTANCIA_DOMICILIO: 'CONSTANCIA_DOMICILIO',
  CARNE_SALUD: 'CARNE_SALUD',
  SOA: 'SOA',
  FOTO: 'FOTO',
  AUTORIZACION_MENOR: 'AUTORIZACION_MENOR',
  LIBRE_MULTAS: 'LIBRE_MULTAS',
  OTRO: 'OTRO',
} as const;
export type TipoDocumento = (typeof TipoDocumento)[keyof typeof TipoDocumento];
