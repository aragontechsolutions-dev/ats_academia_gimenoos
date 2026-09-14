import { useCallback, useEffect, useState } from 'react';
import { DateTime } from 'luxon';

import { TarjetaClase } from '../componentes/TarjetaClase';
import { Aviso } from '../componentes/ui/Aviso';
import { miAgenda } from '../lib/recursos';
import { useSesion } from '../lib/sesion';
import { ZONA } from '../lib/fecha';
import { ESTADOS_VIGENTES, type Reserva } from '../lib/tipos';

/** Cómo se nombra el día que se está mirando. */
function tituloDelDia(dia: DateTime): string {
  const hoy = DateTime.now().setZone(ZONA).startOf('day');
  const diferencia = dia.startOf('day').diff(hoy, 'days').days;
  if (diferencia === 0) return 'Hoy';
  if (diferencia === 1) return 'Mañana';
  if (diferencia === -1) return 'Ayer';
  return primeraMayuscula(dia.toFormat("cccc d 'de' LLLL"));
}

function primeraMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

/**
 * La agenda del instructor, un día por vez.
 *
 * Un día y no una semana: esta app se usa parado al lado del auto, con una mano,
 * para saber quién viene ahora. La semana completa es una vista de escritorio y
 * vive en el panel.
 *
 * La API acota el resultado a la agenda de quien está autenticado: acá no se
 * manda ningún identificador de instructor, y si se mandara lo ignoraría.
 */
export function MiAgenda() {
  const { perfil } = useSesion();
  const [dia, setDia] = useState(() => DateTime.now().setZone(ZONA).startOf('day'));
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    void miAgenda
      .listar(dia.toJSDate(), dia.plus({ days: 1 }).toJSDate())
      .then(setReservas)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, [dia]);

  useEffect(cargar, [cargar]);

  // Las canceladas se muestran al final y no se esconden: si un alumno aparece
  // igual, el instructor tiene que poder ver que esa clase se dio de baja.
  const vigentes = reservas.filter((r) => ESTADOS_VIGENTES.includes(r.estado));
  const cerradas = reservas.filter((r) => !ESTADOS_VIGENTES.includes(r.estado));

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola{perfil?.nombre ? `, ${perfil.nombre}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Tus clases del día</p>
      </header>

      <nav
        className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2"
        aria-label="Día de la agenda"
      >
        <BotonDeDia
          etiqueta="Día anterior"
          simbolo="‹"
          onClick={() => setDia((actual) => actual.minus({ days: 1 }))}
        />
        <div className="min-w-0 text-center">
          <p className="truncate font-semibold text-slate-900">{tituloDelDia(dia)}</p>
          <p className="text-xs tabular-nums text-slate-500">{dia.toFormat('dd/LL/yyyy')}</p>
        </div>
        <BotonDeDia
          etiqueta="Día siguiente"
          simbolo="›"
          onClick={() => setDia((actual) => actual.plus({ days: 1 }))}
        />
      </nav>

      {!dia.hasSame(DateTime.now().setZone(ZONA), 'day') && (
        <button
          type="button"
          onClick={() => setDia(DateTime.now().setZone(ZONA).startOf('day'))}
          className="mt-2 w-full text-sm font-medium text-marca-600 transition hover:text-marca-700"
        >
          Volver a hoy
        </button>
      )}

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      {cargando && <p className="mt-6 text-slate-500">Cargando…</p>}

      {!cargando && reservas.length === 0 && !error && (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
          No tenés clases {tituloDelDia(dia).toLowerCase()}.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {vigentes.map((reserva) => (
          <TarjetaClase key={reserva.id} reserva={reserva} />
        ))}
      </div>

      {cerradas.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Cerradas y canceladas
          </h2>
          <div className="mt-3 space-y-3">
            {cerradas.map((reserva) => (
              <TarjetaClase key={reserva.id} reserva={reserva} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Los dos botones de la barra de día, con un blanco cómodo para el pulgar. */
function BotonDeDia({
  etiqueta,
  simbolo,
  onClick,
}: {
  etiqueta: string;
  simbolo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-slate-600 transition hover:bg-slate-100"
    >
      <span aria-hidden="true">{simbolo}</span>
      <span className="sr-only">{etiqueta}</span>
    </button>
  );
}
