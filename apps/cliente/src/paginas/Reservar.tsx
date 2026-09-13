import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateTime } from 'luxon';

import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { academia, reservar } from '../lib/recursos';
import { fechaLarga, hora } from '../lib/fecha';
import type { ConfiguracionPublica, Hueco, TipoVehiculo } from '../lib/tipos';

const DURACIONES = [30, 45, 60] as const;

export function Reservar() {
  const navegar = useNavigate();

  const [tipo, setTipo] = useState<TipoVehiculo>('AUTO');
  const [duracionMin, setDuracionMin] = useState<number>(45);
  const [dia, setDia] = useState(() => DateTime.now().plus({ days: 1 }).toISODate() ?? '');

  const [huecos, setHuecos] = useState<Hueco[]>([]);
  const [elegido, setElegido] = useState<Hueco | null>(null);
  const [config, setConfig] = useState<ConfiguracionPublica | null>(null);

  const [buscando, setBuscando] = useState(false);
  const [reservando, setReservando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void academia.configuracion().then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    const desde = DateTime.fromISO(dia).startOf('day');
    if (!desde.isValid) return;

    setBuscando(true);
    setElegido(null);
    setError(null);
    void reservar
      .disponibilidad({
        tipo,
        desde: desde.toJSDate(),
        hasta: desde.endOf('day').toJSDate(),
        duracionMin,
      })
      .then(setHuecos)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setBuscando(false));
  }, [tipo, dia, duracionMin]);

  /**
   * Un horario por hora, no uno por instructor.
   *
   * El motor devuelve un hueco por cada combinación de instructor y vehículo
   * libre, que es lo que el panel necesita para elegir con quién. Al alumno eso
   * le muestra la misma hora repetida sin ninguna diferencia visible, y elegir
   * entre dos botones idénticos no es una decisión: es ruido. Se queda el
   * primero de cada hora y la academia asigna el instructor.
   */
  const horarios = useMemo(() => {
    const porHora = new Map<string, Hueco>();
    for (const hueco of huecos) {
      if (!porHora.has(hueco.inicio)) porHora.set(hueco.inicio, hueco);
    }
    return [...porHora.values()];
  }, [huecos]);

  /** Los días que el alumno puede elegir, acotados por la ventana de reserva. */
  const limites = useMemo(() => {
    const ahora = DateTime.now();
    return {
      min: ahora.toISODate() ?? '',
      max: ahora.plus({ days: 60 }).toISODate() ?? '',
    };
  }, []);

  async function confirmar() {
    if (!elegido) return;
    setReservando(true);
    setError(null);
    try {
      await reservar.crear({
        instructorId: elegido.instructorId,
        vehiculoId: elegido.vehiculoId,
        tipo,
        inicio: elegido.inicio,
        duracionMin,
      });
      navegar('/');
    } catch (problema) {
      setError((problema as Error).message);
      setReservando(false);
    }
  }

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Reservar una clase</h1>
        {config && (
          <p className="mt-1 text-sm text-slate-500">
            Con al menos {config.antelacionMinimaHoras} horas de antelación.
          </p>
        )}
      </header>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-slate-700">¿Qué querés manejar?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(['AUTO', 'MOTO'] as TipoVehiculo[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setTipo(opcion)}
              className={`rounded-lg border py-3 text-sm font-semibold transition ${
                tipo === opcion
                  ? 'border-marca-600 bg-marca-50 text-marca-900'
                  : 'border-slate-300 text-slate-700'
              }`}
            >
              {opcion === 'AUTO' ? 'Auto' : 'Moto'}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-slate-700">Duración</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {DURACIONES.map((minutos) => (
            <button
              key={minutos}
              type="button"
              onClick={() => setDuracionMin(minutos)}
              className={`rounded-lg border py-2.5 text-sm transition ${
                duracionMin === minutos
                  ? 'border-marca-600 bg-marca-50 font-semibold text-marca-900'
                  : 'border-slate-300 text-slate-700'
              }`}
            >
              {minutos} min
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-slate-700">Día</span>
        <input
          type="date"
          value={dia}
          min={limites.min}
          max={limites.max}
          onChange={(evento) => setDia(evento.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm focus:border-marca-600 focus:outline-none"
        />
      </label>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-slate-700">Horarios disponibles</h2>

        {buscando && <p className="mt-2 text-sm text-slate-500">Buscando…</p>}

        {!buscando && horarios.length === 0 && !error && (
          <p className="mt-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No hay horarios libres ese día. Probá con otra fecha, otra duración o escribinos.
          </p>
        )}

        {horarios.length > 0 && (
          <>
            <p className="mt-1 text-xs text-slate-500">{fechaLarga(horarios[0]!.inicio)}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {horarios.map((hueco) => {
                const esteElegido = elegido?.inicio === hueco.inicio;
                return (
                  <button
                    key={hueco.inicio}
                    type="button"
                    onClick={() => setElegido(hueco)}
                    className={`rounded-lg border py-3 text-sm transition ${
                      esteElegido
                        ? 'border-marca-600 bg-marca-50 font-semibold text-marca-900'
                        : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    {hora(hueco.inicio)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {elegido && (
        <div className="mt-6 rounded-xl border border-marca-600 bg-marca-50 p-4">
          <p className="font-semibold text-marca-900">{fechaLarga(elegido.inicio)}</p>
          <p className="text-sm text-marca-900">
            {hora(elegido.inicio)} a {hora(elegido.fin)} · clase de {tipo.toLowerCase()}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <Boton
        className="mt-6 w-full"
        disabled={!elegido || reservando}
        onClick={() => void confirmar()}
      >
        {reservando ? 'Reservando…' : 'Confirmar reserva'}
      </Boton>

      <p className="mt-3 text-center text-xs text-slate-500">
        La academia confirma la clase y te avisa.
      </p>
    </>
  );
}
