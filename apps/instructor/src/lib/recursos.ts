/** Llamadas a la API que puede hacer un instructor. */
import { llamarApi } from './api';
import type { EstadoReserva, Reserva } from './tipos';

const query = (parametros: Record<string, string | number | undefined>): string => {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== '') busqueda.set(clave, String(valor));
  }
  return busqueda.toString() ? `?${busqueda}` : '';
};

export const miAgenda = {
  /**
   * Las clases del rango pedido.
   *
   * NO se manda ningún `instructorId`: la API acota el resultado a la agenda de
   * quien está autenticado, y un id ajeno en la consulta lo ignora. Mandarlo
   * daría la impresión de que la app elige qué agenda ver, que es justo lo que
   * no pasa.
   */
  listar: (desde: Date, hasta: Date) =>
    llamarApi<Reserva[]>(
      `/agenda/reservas${query({ desde: desde.toISOString(), hasta: hasta.toISOString() })}`,
    ),

  obtener: (id: string) => llamarApi<Reserva>(`/agenda/reservas/${id}`),

  /** Cierra la clase: dictada o el alumno faltó. */
  cambiarEstado: (id: string, estado: EstadoReserva) =>
    llamarApi<Reserva>(`/agenda/reservas/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    }),
};
