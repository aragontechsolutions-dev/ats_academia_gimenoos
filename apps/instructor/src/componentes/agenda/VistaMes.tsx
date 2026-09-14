import { DateTime } from 'luxon';

import { ZONA } from '../../lib/fecha';
import { casillerosDelMes } from '../../lib/agenda';
import { ESTADOS_VIGENTES, type Reserva } from '../../lib/tipos';

/** Encabezados de la grilla. La semana arranca en lunes, como el calendario de acá. */
const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * El mes como grilla, para ubicarse: qué días tengo cargados y cuáles libres.
 *
 * No muestra nombres ni horarios, y es a propósito: en un teléfono no entran, y
 * la pregunta que se le hace al mes no es «quién viene» sino «cuándo tengo
 * lugar». El número de cada casillero es la cantidad de clases en pie de ese
 * día; tocarlo abre el día completo.
 *
 * Las clases canceladas o ya cerradas no suman al conteo: un día con tres clases
 * canceladas está libre, y pintarlo como ocupado sería justo el error contrario
 * al que esta vista viene a evitar.
 */
export function VistaMes({
  reservas,
  referencia,
  onElegirDia,
}: {
  reservas: Reserva[];
  referencia: DateTime;
  onElegirDia: (dia: DateTime) => void;
}) {
  const hoy = DateTime.now().setZone(ZONA).startOf('day');

  // Se cuenta por la fecha local, no por la UTC que manda la API: una clase de
  // las 21:00 de Montevideo cae al día siguiente en UTC y se contaría mal.
  const porFecha = new Map<string, number>();
  for (const reserva of reservas) {
    if (!ESTADOS_VIGENTES.includes(reserva.estado)) continue;
    const clave = DateTime.fromISO(reserva.inicio, { zone: ZONA }).toISODate() ?? '';
    porFecha.set(clave, (porFecha.get(clave) ?? 0) + 1);
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
        {INICIALES.map((inicial, indice) => (
          <span key={`${inicial}-${indice}`}>{inicial}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {casillerosDelMes(referencia).map((dia) => {
          const clave = dia.toISODate() ?? '';
          const cantidad = porFecha.get(clave) ?? 0;
          const delMes = dia.hasSame(referencia, 'month');
          const esHoy = dia.hasSame(hoy, 'day');

          return (
            <button
              key={clave}
              type="button"
              onClick={() => onElegirDia(dia)}
              // aspect-square para que la grilla no se deforme con meses de
              // cinco o seis semanas.
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition ${
                esHoy ? 'border-marca-600 bg-marca-50' : 'border-slate-200 bg-white'
              } ${delMes ? 'text-slate-900' : 'text-slate-300'} hover:border-slate-400`}
            >
              <span className={`tabular-nums ${esHoy ? 'font-bold text-marca-700' : ''}`}>
                {dia.day}
              </span>
              {/* La cantidad va escrita y no como un punto: «3» y «1» dicen algo
                  distinto, y un punto los haría ver iguales. */}
              {cantidad > 0 && (
                <span className="rounded bg-carbon-900 px-1.5 text-[11px] font-semibold leading-4 text-white">
                  {cantidad}
                </span>
              )}
              <span className="sr-only">
                {cantidad === 0
                  ? 'sin clases'
                  : cantidad === 1
                    ? '1 clase'
                    : `${cantidad} clases`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
