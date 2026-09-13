import { minutosDelDia, duracionEnMinutos, hora } from '../../lib/fecha';
import { COLOR_ESTADO, type Reserva } from '../../lib/tipos';

/** Alto de una hora en la grilla. Define la escala de todo el calendario. */
const ALTO_HORA = 56;
const HORA_MINIMA = 6;
const HORA_MAXIMA = 23;

export interface ColumnaAgenda {
  id: string;
  titulo: string;
  subtitulo?: string;
  /** Color del encabezado, para distinguir instructores de un vistazo. */
  color?: string;
  reservas: Reserva[];
  /** Se dispara al hacer clic en un espacio vacío de la columna. */
  alClickVacio?: () => void;
}

/**
 * Rango horario que se dibuja.
 *
 * Se ajusta a lo que hay: no tiene sentido mostrar de 6 a 23 si todas las clases
 * van de 9 a 13. Si no hay ninguna clase, se muestra una jornada típica.
 */
function rangoVisible(columnas: ColumnaAgenda[]): { desde: number; hasta: number } {
  const todas = columnas.flatMap((c) => c.reservas);
  if (todas.length === 0) return { desde: 8, hasta: 20 };

  const inicios = todas.map((r) => Math.floor(minutosDelDia(r.inicio) / 60));
  const fines = todas.map((r) => Math.ceil(minutosDelDia(r.fin) / 60));

  return {
    desde: Math.max(HORA_MINIMA, Math.min(...inicios) - 1),
    hasta: Math.min(HORA_MAXIMA, Math.max(...fines) + 1),
  };
}

export function GrillaHoraria({
  columnas,
  alSeleccionar,
}: {
  columnas: ColumnaAgenda[];
  alSeleccionar: (reserva: Reserva) => void;
}) {
  const { desde, hasta } = rangoVisible(columnas);
  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i);
  const alto = horas.length * ALTO_HORA;

  if (columnas.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        No hay instructores activos para mostrar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-[640px]">
        {/* Encabezados */}
        <div className="flex border-b border-slate-200">
          <div className="w-14 shrink-0" />
          {columnas.map((columna) => (
            <div
              key={columna.id}
              className="flex-1 border-l border-slate-100 px-2 py-2 text-center"
              style={columna.color ? { borderTop: `3px solid ${columna.color}` } : undefined}
            >
              <p className="truncate text-sm font-semibold text-slate-900">{columna.titulo}</p>
              {columna.subtitulo && (
                <p className="truncate text-xs text-slate-500">{columna.subtitulo}</p>
              )}
            </div>
          ))}
        </div>

        {/* Cuerpo */}
        <div className="flex" style={{ height: alto }}>
          {/* Regla horaria */}
          <div className="w-14 shrink-0">
            {horas.map((h) => (
              <div
                key={h}
                className="relative border-b border-slate-100 text-right"
                style={{ height: ALTO_HORA }}
              >
                <span className="absolute -top-2 right-2 bg-white px-1 text-xs text-slate-400">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {columnas.map((columna) => (
            <div
              key={columna.id}
              className="relative flex-1 border-l border-slate-100"
              onClick={columna.alClickVacio}
              role={columna.alClickVacio ? 'button' : undefined}
              tabIndex={columna.alClickVacio ? 0 : undefined}
            >
              {horas.map((h) => (
                <div key={h} className="border-b border-slate-100" style={{ height: ALTO_HORA }} />
              ))}

              {columna.reservas.map((reserva) => {
                const minutosInicio = minutosDelDia(reserva.inicio);
                const duracion = duracionEnMinutos(reserva.inicio, reserva.fin);
                const arriba = ((minutosInicio - desde * 60) / 60) * ALTO_HORA;

                return (
                  <button
                    key={reserva.id}
                    type="button"
                    onClick={(evento) => {
                      evento.stopPropagation();
                      alSeleccionar(reserva);
                    }}
                    className={`absolute left-1 right-1 overflow-hidden rounded border px-1.5 py-1 text-left text-xs transition hover:brightness-95 ${COLOR_ESTADO[reserva.estado]}`}
                    style={{ top: arriba, height: Math.max((duracion / 60) * ALTO_HORA - 2, 20) }}
                  >
                    <span className="block truncate font-semibold">
                      {hora(reserva.inicio)} {reserva.cliente.nombre} {reserva.cliente.apellido}
                    </span>
                    <span className="block truncate opacity-80">
                      {reserva.vehiculo?.patente ?? 'sin vehículo'} · {reserva.tipo.toLowerCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
