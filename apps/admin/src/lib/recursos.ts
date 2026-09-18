/** Funciones tipadas contra la API, agrupadas por dominio. */
import { llamarApi } from './api';
import type { Pagina } from '../componentes/ui/Paginacion';
import type {
  Cliente, FichaCliente, Excepcion, Franja, Hueco, Instructor, Reserva, Servicio, TipoVehiculo,
  Vehiculo, EstadoReserva, SeccionLanding, NegocioLanding, Graduado, Invitacion,
  CuentaUsuario, Rol, EstadoInvitacion, CanalInvitacion, Pago, ResumenDelTablero,
} from './tipos';

const query = (parametros: Record<string, string | number | boolean | undefined>): string => {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== '') busqueda.set(clave, String(valor));
  }
  const texto = busqueda.toString();
  return texto ? `?${texto}` : '';
};

// --- Agenda ----------------------------------------------------------------

export const agenda = {
  reservas: (p: {
    desde: Date;
    hasta: Date;
    instructorId?: string;
    vehiculoId?: string;
    clienteId?: string;
    estado?: EstadoReserva;
  }) =>
    llamarApi<Reserva[]>(
      `/agenda/reservas${query({
        desde: p.desde.toISOString(),
        hasta: p.hasta.toISOString(),
        instructorId: p.instructorId,
        vehiculoId: p.vehiculoId,
        clienteId: p.clienteId,
        estado: p.estado,
      })}`,
    ),

  disponibilidad: (p: {
    tipo: TipoVehiculo;
    desde: Date;
    hasta: Date;
    duracionMin: number;
    instructorId?: string;
  }) =>
    llamarApi<Hueco[]>(
      `/agenda/disponibilidad${query({
        tipo: p.tipo,
        desde: p.desde.toISOString(),
        hasta: p.hasta.toISOString(),
        duracionMin: p.duracionMin,
        instructorId: p.instructorId,
      })}`,
    ),

  crearReserva: (cuerpo: {
    clienteId: string;
    instructorId: string;
    vehiculoId: string;
    tipo: TipoVehiculo;
    inicio: string;
    duracionMin: number;
    lugarEncuentro?: string;
    observaciones?: string;
  }) => llamarApi<Reserva>('/agenda/reservas', { method: 'POST', body: JSON.stringify(cuerpo) }),

  cancelar: (id: string, motivo?: string) =>
    llamarApi<Reserva>(`/agenda/reservas/${id}/cancelar`, {
      method: 'PATCH',
      body: JSON.stringify({ motivo }),
    }),

  cambiarEstado: (id: string, estado: 'CONFIRMADA' | 'COMPLETADA' | 'AUSENTE') =>
    llamarApi<Reserva>(`/agenda/reservas/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    }),

  reprogramar: (id: string, cuerpo: { inicio: string; duracionMin: number; instructorId?: string; vehiculoId?: string }) =>
    llamarApi<Reserva>(`/agenda/reservas/${id}/reprogramar`, {
      method: 'PATCH',
      body: JSON.stringify(cuerpo),
    }),
};

// --- Instructores ----------------------------------------------------------

export const instructores = {
  listar: (p: { incluirInactivos?: boolean; pagina?: number; porPagina?: number } = {}) =>
    llamarApi<Pagina<Instructor>>(
      `/instructores${query({ incluirInactivos: p.incluirInactivos, pagina: p.pagina, porPagina: p.porPagina })}`,
    ),

  obtener: (id: string) => llamarApi<Instructor>(`/instructores/${id}`),

  crear: (cuerpo: Partial<Instructor>) =>
    llamarApi<Instructor>('/instructores', { method: 'POST', body: JSON.stringify(cuerpo) }),

  actualizar: (id: string, cuerpo: Partial<Instructor>) =>
    llamarApi<Instructor>(`/instructores/${id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),

  guardarDisponibilidad: (id: string, franjas: Franja[]) =>
    llamarApi<Instructor>(`/instructores/${id}/disponibilidad`, {
      method: 'PUT',
      body: JSON.stringify({
        franjas: franjas.map(({ diaSemana, minutoInicio, minutoFin }) => ({
          diaSemana,
          minutoInicio,
          minutoFin,
        })),
      }),
    }),

  crearExcepcion: (id: string, cuerpo: Omit<Excepcion, 'id'>) =>
    llamarApi<Excepcion>(`/instructores/${id}/excepciones`, {
      method: 'POST',
      body: JSON.stringify(cuerpo),
    }),

  eliminarExcepcion: async (id: string, excepcionId: string) => {
    await llamarApi<void>(`/instructores/${id}/excepciones/${excepcionId}`, { method: 'DELETE' });
  },
};

// --- Vehículos -------------------------------------------------------------

export const vehiculos = {
  listar: (p: { incluirInactivos?: boolean; pagina?: number; porPagina?: number } = {}) =>
    llamarApi<Pagina<Vehiculo>>(
      `/vehiculos${query({ incluirInactivos: p.incluirInactivos, pagina: p.pagina, porPagina: p.porPagina })}`,
    ),

  crear: (cuerpo: Partial<Vehiculo>) =>
    llamarApi<Vehiculo>('/vehiculos', { method: 'POST', body: JSON.stringify(cuerpo) }),

  actualizar: (id: string, cuerpo: Partial<Vehiculo>) =>
    llamarApi<Vehiculo>(`/vehiculos/${id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),

  /**
   * La foto va por su propio endpoint: `actualizar` reemplaza la ficha entera y
   * mandarla con solo la foto borraría marca, modelo y SOA.
   */
  guardarFoto: (id: string, fotoRuta: string) =>
    llamarApi<Vehiculo>(`/vehiculos/${id}/foto`, {
      method: 'PATCH',
      body: JSON.stringify({ fotoRuta }),
    }),
};

// --- Cuentas ---------------------------------------------------------------

export const usuarios = {
  listar: (p: {
    rol?: Rol;
    incluirInactivos?: boolean;
    q?: string;
    pagina?: number;
    porPagina?: number;
  } = {}) => llamarApi<Pagina<CuentaUsuario>>(`/usuarios${query({ ...p })}`),

  actualizar: (id: string, cuerpo: { rol?: Rol; activo?: boolean }) =>
    llamarApi<CuentaUsuario>(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
};

// --- Invitaciones ----------------------------------------------------------

export const invitaciones = {
  listar: (p: { clienteId?: string; instructorId?: string; estado?: EstadoInvitacion } = {}) =>
    llamarApi<Invitacion[]>(`/invitaciones${query({ ...p })}`),

  deCliente: (clienteId: string) =>
    llamarApi<Invitacion[]>(`/invitaciones${query({ clienteId })}`),

  crear: (cuerpo: {
    rol: Rol;
    clienteId?: string;
    instructorId?: string;
    email?: string;
    canal?: CanalInvitacion;
  }) => llamarApi<Invitacion>('/invitaciones', { method: 'POST', body: JSON.stringify(cuerpo) }),

  reenviar: (id: string, canal: CanalInvitacion = 'CORREO') =>
    llamarApi<Invitacion>(`/invitaciones/${id}/reenviar`, {
      method: 'POST',
      body: JSON.stringify({ canal }),
    }),

  revocar: (id: string) => llamarApi<Invitacion>(`/invitaciones/${id}`, { method: 'DELETE' }),
};

// --- Catálogo --------------------------------------------------------------

export const servicios = {
  listar: () => llamarApi<Servicio[]>('/catalogo/servicios/todos'),

  crear: (cuerpo: Record<string, unknown>) =>
    llamarApi<Servicio>('/catalogo/servicios', { method: 'POST', body: JSON.stringify(cuerpo) }),

  actualizar: (id: string, cuerpo: Record<string, unknown>) =>
    llamarApi<Servicio>(`/catalogo/servicios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cuerpo),
    }),
};

// --- Alumnos ---------------------------------------------------------------

export const clientes = {
  listar: (p: { q?: string; incluirInactivos?: boolean; pagina?: number; porPagina?: number } = {}) =>
    llamarApi<Pagina<Cliente>>(
      `/clientes${query({ q: p.q, incluirInactivos: p.incluirInactivos, pagina: p.pagina, porPagina: p.porPagina })}`,
    ),

  obtener: (id: string) => llamarApi<FichaCliente>(`/clientes/${id}`),

  crear: (cuerpo: Record<string, unknown>) =>
    llamarApi<Cliente>('/clientes', { method: 'POST', body: JSON.stringify(cuerpo) }),

  actualizar: (id: string, cuerpo: Record<string, unknown>) =>
    llamarApi<Cliente>(`/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
};

// --- Sitio público ---------------------------------------------------------

export const sitio = {
  secciones: () => llamarApi<SeccionLanding[]>('/landing/secciones'),

  guardarSeccion: (clave: string, cuerpo: Record<string, unknown>) =>
    llamarApi<unknown>(`/landing/secciones/${encodeURIComponent(clave)}`, {
      method: 'PUT',
      body: JSON.stringify(cuerpo),
    }),

  negocio: () => llamarApi<NegocioLanding>('/landing/negocio'),

  guardarNegocio: (cuerpo: Record<string, unknown>) =>
    llamarApi<NegocioLanding>('/landing/negocio', {
      method: 'PATCH',
      body: JSON.stringify(cuerpo),
    }),
};

// --- Egresados -------------------------------------------------------------

export const graduados = {
  listar: (p: { anio?: number; sinAutorizacion?: boolean; pagina?: number; porPagina?: number } = {}) =>
    llamarApi<Pagina<Graduado>>(
      `/graduados${query({ anio: p.anio, sinAutorizacion: p.sinAutorizacion, pagina: p.pagina, porPagina: p.porPagina })}`,
    ),

  /**
   * Años con egresados y cuántos esperan autorización, sobre el total y no
   * sobre la página que se está viendo.
   */
  resumen: () => llamarApi<{ sinAutorizacion: number; anios: number[] }>('/graduados/resumen'),

  crear: (cuerpo: Record<string, unknown>) =>
    llamarApi<Graduado>('/graduados', { method: 'POST', body: JSON.stringify(cuerpo) }),

  actualizar: (id: string, cuerpo: Record<string, unknown>) =>
    llamarApi<Graduado>(`/graduados/${id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),

  retirarAutorizacion: (id: string) =>
    llamarApi<Graduado>(`/graduados/${id}/retirar-autorizacion`, { method: 'POST' }),

  eliminar: (id: string) =>
    llamarApi<{ eliminado: boolean }>(`/graduados/${id}`, { method: 'DELETE' }),
};

// --- Avisos por Telegram ---------------------------------------------------

export interface EstadoAvisosTelegram {
  /** Si el servidor tiene cargado el token del bot. El panel nunca ve el token. */
  botConfigurado: boolean;
  chatId: string | null;
  chatNombre: string | null;
  avisaReservaNueva: boolean;
  avisaClaseCerrada: boolean;
  avisaClaseCancelada: boolean;
  avisaClicWhatsapp: boolean;
  avisaRecordatorios: boolean;
  ultimoEnvioAt: string | null;
  ultimoErrorAt: string | null;
  ultimoError: string | null;
}

export interface ChatDeTelegram {
  id: string;
  nombre: string;
  tipo: 'privado' | 'grupo';
}

export const avisosTelegram = {
  estado: () => llamarApi<EstadoAvisosTelegram>('/avisos/telegram'),

  /** Conversaciones que le hablaron al bot en las últimas 24 horas. */
  chats: () => llamarApi<ChatDeTelegram[]>('/avisos/telegram/chats'),

  guardar: (cuerpo: Record<string, unknown>) =>
    llamarApi<EstadoAvisosTelegram>('/avisos/telegram', {
      method: 'PATCH',
      body: JSON.stringify(cuerpo),
    }),

  probar: () => llamarApi<{ enviado: boolean }>('/avisos/telegram/probar', { method: 'POST' }),
};

// --- Pagos -----------------------------------------------------------------

export const pagos = {
  listar: (consulta: { pagina?: number; porPagina?: number; estado?: string; q?: string }) =>
    llamarApi<Pagina<Pago>>(`/pagos${query(consulta)}`),

  obtener: (id: string) => llamarApi<Pago>(`/pagos/${id}`),

  /** Una dirección temporal para ver el comprobante. Se pide cada vez. */
  verComprobante: (id: string) => llamarApi<{ url: string }>(`/pagos/${id}/comprobante`),

  registrarEfectivo: (cuerpo: Record<string, unknown>) =>
    llamarApi<Pago>('/pagos/efectivo', { method: 'POST', body: JSON.stringify(cuerpo) }),

  aprobar: (id: string, cuerpo: Record<string, unknown> = {}) =>
    llamarApi<Pago>(`/pagos/${id}/aprobar`, { method: 'POST', body: JSON.stringify(cuerpo) }),

  rechazar: (id: string, motivo: string) =>
    llamarApi<Pago>(`/pagos/${id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),
};

// --- Tablero ---------------------------------------------------------------

export const tablero = {
  /**
   * El resumen del período. Sin `desde`/`hasta`, la API devuelve el mes en curso.
   *
   * Las fechas van como día suelto (`2026-09-18`) y no como instante: el corte
   * lo hace el servidor en la hora de San Carlos, para que el número no dependa
   * del reloj de la computadora desde la que se mire.
   */
  resumen: (consulta: { desde?: string; hasta?: string } = {}) =>
    llamarApi<ResumenDelTablero>(`/tablero${query(consulta)}`),
};
