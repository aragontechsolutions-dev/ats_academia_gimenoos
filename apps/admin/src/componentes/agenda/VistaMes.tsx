import { DateTime } from 'luxon';
import { COLOR_ESTADO, type Reserva } from '../../lib/tipos';
import { aLocal, hora } from '../../lib/fecha';

/**
 * Vista de mes: sirve para ver la carga general, no el detalle.
 * Por eso muestra hasta tres clases por día y un contador con el resto.
 */
export function VistaMes({
  mes,
  reservas,
  alSeleccionar,
  alElegirDia,
}: {
  mes: DateTime;
  reservas: Reserva[];
  alSeleccionar: (reserva: Reserva) => void;
  alElegirDia: (dia: DateTime) => void;
}) {
  const primerDia = mes.startOf('month').startOf('week');
  const ultimoDia = mes.endOf('month').endOf('week');
  const dias: DateTime[] = [];
  for (let d = primerDia; d <= ultimoDia; d = d.plus({ days: 1 })) dias.push(d);

  const porDia = new Map<string, Reserva[]>();
  for (const reserva of reservas) {
    const clave = aLocal(reserva.inicio).toISODate() ?? '';
    porDia.set(clave, [...(porDia.get(clave) ?? []), reserva]);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const delDia = porDia.get(dia.toISODate() ?? '') ?? [];
          const esDelMes = dia.month === mes.month;
          const esHoy = dia.hasSame(DateTime.now(), 'day');

          return (
            <div
              key={dia.toISO()}
              className={`min-h-24 border-b border-r border-slate-100 p-1 ${esDelMes ? '' : 'bg-slate-50/60'}`}
            >
              <button
                type="button"
                onClick={() => alElegirDia(dia)}
                className={`mb-1 h-6 w-6 rounded-full text-xs ${
                  esHoy ? 'bg-marca-600 font-bold text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {dia.day}
              </button>

              <div className="space-y-0.5">
                {delDia.slice(0, 3).map((reserva) => (
                  <button
                    key={reserva.id}
                    type="button"
                    onClick={() => alSeleccionar(reserva)}
                    className={`block w-full truncate rounded border px-1 text-left text-[11px] ${COLOR_ESTADO[reserva.estado]}`}
                  >
                    {hora(reserva.inicio)} {reserva.cliente.apellido}
                  </button>
                ))}
                {delDia.length > 3 && (
                  <button
                    type="button"
                    onClick={() => alElegirDia(dia)}
                    className="block w-full px-1 text-left text-[11px] text-slate-500 hover:text-marca-600"
                  >
                    +{delDia.length - 3} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
