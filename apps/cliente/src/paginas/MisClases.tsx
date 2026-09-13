import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DateTime } from 'luxon';

import { TarjetaClase } from '../componentes/TarjetaClase';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { academia, misClases } from '../lib/recursos';
import { useSesion } from '../lib/sesion';
import { ESTADOS_VIGENTES, type ConfiguracionPublica, type Reserva } from '../lib/tipos';

export function MisClases() {
  const { perfil } = useSesion();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [config, setConfig] = useState<ConfiguracionPublica | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    // Un año hacia atrás alcanza para el historial de un alumno, y tres meses
    // hacia adelante cubren de sobra la ventana de reserva.
    void misClases
      .listar(
        DateTime.now().minus({ years: 1 }).toJSDate(),
        DateTime.now().plus({ months: 3 }).toJSDate(),
      )
      .then(setReservas)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);
  useEffect(() => {
    void academia.configuracion().then(setConfig).catch(() => setConfig(null));
  }, []);

  async function cancelar(id: string) {
    setCancelando(id);
    setError(null);
    try {
      await misClases.cancelar(id);
      cargar();
    } catch (problema) {
      setError((problema as Error).message);
    } finally {
      setCancelando(null);
    }
  }

  const ahora = new Date();
  const proximas = reservas
    .filter((r) => new Date(r.inicio) >= ahora && ESTADOS_VIGENTES.includes(r.estado))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const anteriores = reservas
    .filter((r) => !proximas.includes(r))
    .sort((a, b) => b.inicio.localeCompare(a.inicio));

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola{perfil?.nombre ? `, ${perfil.nombre}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Tus clases de manejo</p>
      </header>

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      {cargando && <p className="mt-6 text-slate-500">Cargando…</p>}

      <section className="mt-6">
        <h2 className="font-semibold text-slate-900">Próximas</h2>

        {!cargando && proximas.length === 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center">
            <p className="text-slate-600">No tenés clases agendadas.</p>
            <Link to="/reservar" className="mt-3 inline-block">
              <Boton>Reservar una clase</Boton>
            </Link>
          </div>
        )}

        <div className="mt-3 space-y-3">
          {proximas.map((reserva) => (
            <TarjetaClase
              key={reserva.id}
              reserva={reserva}
              accion={
                <Boton
                  variante="peligro"
                  className="w-full"
                  disabled={cancelando === reserva.id}
                  onClick={() => void cancelar(reserva.id)}
                >
                  {cancelando === reserva.id ? 'Cancelando…' : 'Cancelar clase'}
                </Boton>
              }
            />
          ))}
        </div>

        {proximas.length > 0 && config && (
          <p className="mt-3 text-xs text-slate-500">
            Podés cancelar hasta {config.cancelacionMinimaHoras} horas antes. Si falta menos,
            comunicate con la academia.
          </p>
        )}
      </section>

      {anteriores.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">Anteriores</h2>
          <div className="mt-3 space-y-3">
            {anteriores.map((reserva) => (
              <TarjetaClase key={reserva.id} reserva={reserva} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
