/** Funciones tipadas contra la API, agrupadas por dominio. */
import { llamarApi } from './api';
import type {
  Cliente, FichaCliente, Excepcion, Franja, Hueco, Instructor, Reserva, Servicio, TipoVehiculo,
  Vehiculo, EstadoReserva, SeccionLanding, NegocioLanding, Graduado,
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
  listar: (incluirInactivos = false) =>
    llamarApi<Instructor[]>(`/instructores${query({ incluirInactivos })}`),

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
  listar: (incluirInactivos = false) =>
    llamarApi<Vehiculo[]>(`/vehiculos${query({ incluirInactivos })}`),

  crear: (cuerpo: Partial<Vehiculo>) =>
    llamarApi<Vehiculo>('/vehiculos', { method: 'POST', body: JSON.stringify(cuerpo) }),

  actualizar: (id: string, cuerpo: Partial<Vehiculo>) =>
    llamarApi<Vehiculo>(`/vehiculos/${id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
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
  listar: (p: { q?: string; incluirInactivos?: boolean } = {}) =>
    llamarApi<Cliente[]>(`/clientes${query({ q: p.q, incluirInactivos: p.incluirInactivos })}`),

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
  listar: (p: { anio?: number; sinAutorizacion?: boolean } = {}) =>
    llamarApi<Graduado[]>(`/graduados${query({ anio: p.anio, sinAutorizacion: p.sinAutorizacion })}`),

  crear: (cuerpo: Record<string, unknown>) =>
    llamarApi<Graduado>('/graduados', { method: 'POST', body: JSON.stringify(cuerpo) }),

  actualizar: (id: string, cuerpo: Record<string, unknown>) =>
    llamarApi<Graduado>(`/graduados/${id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),

  retirarAutorizacion: (id: string) =>
    llamarApi<Graduado>(`/graduados/${id}/retirar-autorizacion`, { method: 'POST' }),

  eliminar: (id: string) =>
    llamarApi<{ eliminado: boolean }>(`/graduados/${id}`, { method: 'DELETE' }),
};
