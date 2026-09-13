/** Llamadas a la API que puede hacer un alumno. */
import { llamarApi } from './api';
import type { ConfiguracionPublica, Hueco, MiFicha, Reserva, TipoVehiculo } from './tipos';

const query = (parametros: Record<string, string | number | undefined>): string => {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== '') busqueda.set(clave, String(valor));
  }
  return busqueda.toString() ? `?${busqueda}` : '';
};

export const misClases = {
  /** La API acota el resultado a las clases del alumno autenticado. */
  listar: (desde: Date, hasta: Date) =>
    llamarApi<Reserva[]>(
      `/agenda/reservas${query({ desde: desde.toISOString(), hasta: hasta.toISOString() })}`,
    ),

  cancelar: (id: string, motivo?: string) =>
    llamarApi<Reserva>(`/agenda/reservas/${id}/cancelar`, {
      method: 'PATCH',
      body: JSON.stringify({ motivo }),
    }),
};

export const reservar = {
  disponibilidad: (p: { tipo: TipoVehiculo; desde: Date; hasta: Date; duracionMin: number }) =>
    llamarApi<Hueco[]>(
      `/agenda/disponibilidad${query({
        tipo: p.tipo,
        desde: p.desde.toISOString(),
        hasta: p.hasta.toISOString(),
        duracionMin: p.duracionMin,
      })}`,
    ),

  /**
   * No se envía el alumno: la API usa la ficha de quien está autenticado.
   * Mandarlo no serviría de nada, porque lo ignora.
   */
  crear: (cuerpo: {
    instructorId: string;
    vehiculoId: string;
    tipo: TipoVehiculo;
    inicio: string;
    duracionMin: number;
  }) => llamarApi<Reserva>('/agenda/reservas', { method: 'POST', body: JSON.stringify(cuerpo) }),
};

export const miFicha = {
  obtener: () => llamarApi<MiFicha>('/clientes/me'),

  actualizar: (cuerpo: Record<string, unknown>) =>
    llamarApi<MiFicha>('/clientes/me', { method: 'PATCH', body: JSON.stringify(cuerpo) }),
};

export const academia = {
  configuracion: () => llamarApi<ConfiguracionPublica>('/configuracion/publica'),
};
