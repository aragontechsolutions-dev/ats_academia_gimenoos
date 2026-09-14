import type { DateTime } from 'luxon';

import { hora, soloPrimeraMayuscula } from '../../lib/fecha';
import { porDia } from '../../lib/agenda';
import { COLOR_ESTADO, ETIQUETA_ESTADO, type Reserva } from '../../lib/tipos';

/**
 * La semana como lista agrupada por día, no como grilla de siete columnas.
 *
 * Siete columnas es la vista del panel y funciona en una pantalla ancha. En un
 * teléfono cada columna quedaría de cuarenta píxeles y no entraría ni el nombre
 * del alumno. Acá se lee de arriba abajo, que es como se lee todo lo demás en el
 * teléfono.
 *
 * Cada renglón lleva a su día: las acciones —cerrar, cancelar, llamar— viven
 * solo en la vista de día, para que no se pueda cerrar la clase equivocada desde
 * una lista apretada.
 */
export function VistaSemana({
  reservas,
  hoy,
  onElegirDia,
}: {
  reservas: Reserva[];
  hoy: DateTime;
  onElegirDia: (dia: DateTime) => void;
}) {
  const dias = porDia(reservas);

  if (dias.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
        No tenés clases esta semana.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {dias.map(({ dia, reservas: delDia }) => (
        <section key={dia.toISODate()}>
          <h2 className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {soloPrimeraMayuscula(dia.toFormat('cccc d'))}
            </span>
            {dia.hasSame(hoy, 'day') && (
              <span className="rounded bg-marca-600 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                Hoy
              </span>
            )}
            <span className="text-xs text-slate-500">
              {delDia.length === 1 ? '1 clase' : `${delDia.length} clases`}
            </span>
          </h2>

          <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {delDia.map((reserva) => (
              <li key={reserva.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onElegirDia(dia)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {hora(reserva.inicio)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {reserva.cliente.nombre} {reserva.cliente.apellido}
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[reserva.estado]}`}
                  >
                    {ETIQUETA_ESTADO[reserva.estado]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
