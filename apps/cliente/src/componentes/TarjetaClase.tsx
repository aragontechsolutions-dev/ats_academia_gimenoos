import { fechaLarga, hora } from '../lib/fecha';
import { COLOR_ESTADO, ETIQUETA_ESTADO, type Reserva } from '../lib/tipos';

export function TarjetaClase({
  reserva,
  accion,
}: {
  reserva: Reserva;
  accion?: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{fechaLarga(reserva.inicio)}</p>
          <p className="text-sm text-slate-600">
            {hora(reserva.inicio)} a {hora(reserva.fin)} · clase de {reserva.tipo.toLowerCase()}
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[reserva.estado]}`}>
          {ETIQUETA_ESTADO[reserva.estado]}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-sm text-slate-600">
        <div className="flex gap-2">
          <dt className="text-slate-400">Instructor</dt>
          <dd>
            {reserva.instructor.nombre} {reserva.instructor.apellido}
          </dd>
        </div>
        {reserva.vehiculo && (
          <div className="flex gap-2">
            <dt className="text-slate-400">Vehículo</dt>
            <dd>{reserva.vehiculo.patente}</dd>
          </div>
        )}
        {reserva.lugarEncuentro && (
          <div className="flex gap-2">
            <dt className="text-slate-400">Dónde</dt>
            <dd>{reserva.lugarEncuentro}</dd>
          </div>
        )}
      </dl>

      {reserva.estado === 'PENDIENTE' && (
        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          La academia todavía tiene que confirmarla. Te avisamos.
        </p>
      )}

      {reserva.motivoCancelacion && (
        <p className="mt-3 text-xs text-slate-500">Motivo: {reserva.motivoCancelacion}</p>
      )}

      {accion && <div className="mt-3">{accion}</div>}
    </article>
  );
}
