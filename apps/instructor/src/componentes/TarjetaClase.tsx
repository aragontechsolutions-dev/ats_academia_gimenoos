import type { ReactNode } from 'react';

import { hora } from '../lib/fecha';
import { COLOR_ESTADO, ETIQUETA_ESTADO, type Reserva } from '../lib/tipos';
import { numeroParaWhatsApp } from '../lib/whatsapp';

/**
 * Una clase, vista por el instructor.
 *
 * Lo primero y más grande es **la hora y el alumno**: es lo que se busca de un
 * vistazo antes de salir. El vehículo y el lugar van debajo; el estado, a un
 * costado.
 */
export function TarjetaClase({
  reserva,
  accion,
  nota,
}: {
  reserva: Reserva;
  /** Cerrar la clase, cuando corresponde. */
  accion?: ReactNode;
  /** La observación del instructor sobre cómo fue. */
  nota?: ReactNode;
}) {
  const telefono = numeroParaWhatsApp(reserva.cliente.telefono);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums text-slate-900">
            {hora(reserva.inicio)} <span className="text-slate-400">a</span> {hora(reserva.fin)}
          </p>
          <p className="truncate font-semibold text-slate-900">
            {reserva.cliente.nombre} {reserva.cliente.apellido}
          </p>
          <p className="text-sm text-slate-600">Clase de {reserva.tipo.toLowerCase()}</p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[reserva.estado]}`}
        >
          {ETIQUETA_ESTADO[reserva.estado]}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-sm text-slate-600">
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
        {reserva.cliente.telefono && (
          <div className="flex gap-2">
            <dt className="text-slate-400">Teléfono</dt>
            <dd className="flex flex-wrap items-center gap-x-3">
              {/* Llamar y escribir son dos cosas distintas y las dos hacen falta
                  cuando el alumno no aparece en el punto de encuentro. */}
              <a href={`tel:${reserva.cliente.telefono.replace(/\s/g, '')}`} className="underline">
                {reserva.cliente.telefono}
              </a>
              {telefono && (
                <a
                  href={`https://wa.me/${telefono}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-marca-600 underline"
                >
                  WhatsApp
                </a>
              )}
            </dd>
          </div>
        )}
      </dl>

      {reserva.observaciones && (
        <div className="mt-3">
          {/* Con etiqueta: justo debajo aparece la observación del instructor, y
              sin decir de quién es cada una se confunden. */}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            De la academia
          </p>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
            {reserva.observaciones}
          </p>
        </div>
      )}

      {reserva.motivoCancelacion && (
        <p className="mt-3 text-xs text-slate-500">Motivo: {reserva.motivoCancelacion}</p>
      )}

      {accion && <div className="mt-3">{accion}</div>}

      {nota && <div className="mt-3 border-t border-slate-100 pt-3">{nota}</div>}
    </article>
  );
}
