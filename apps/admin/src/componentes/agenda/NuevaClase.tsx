import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';

import { Modal } from '../ui/Modal';
import { Boton } from '../ui/Boton';
import { Aviso } from '../ui/Aviso';
import { Campo, clasesControl } from '../ui/Campo';
import { agenda, clientes as apiClientes } from '../../lib/recursos';
import { fechaLarga, hora } from '../../lib/fecha';
import type { Cliente, Hueco, Instructor, TipoVehiculo } from '../../lib/tipos';

/**
 * Alta de clase.
 *
 * El horario no se escribe a mano: se elige entre los que el motor de
 * disponibilidad informa como realmente libres. Escribirlo permitiría pedir un
 * horario ocupado, que la base rechazaría con un error después de completar
 * todo el formulario.
 */
export function NuevaClase({
  instructores,
  diaInicial,
  onCerrar,
  onCreada,
}: {
  instructores: Instructor[];
  diaInicial: DateTime;
  onCerrar: () => void;
  onCreada: () => void;
}) {
  const [tipo, setTipo] = useState<TipoVehiculo>('AUTO');
  const [duracionMin, setDuracionMin] = useState(45);
  const [dia, setDia] = useState(diaInicial.toISODate() ?? '');
  const [instructorId, setInstructorId] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [alumno, setAlumno] = useState<Cliente | null>(null);

  const [huecos, setHuecos] = useState<Hueco[]>([]);
  const [huecoElegido, setHuecoElegido] = useState<Hueco | null>(null);
  const [observaciones, setObservaciones] = useState('');

  const [cargandoHuecos, setCargandoHuecos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Búsqueda de alumno con espera, para no disparar una consulta por tecla.
  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setResultados([]);
      return;
    }
    const temporizador = setTimeout(() => {
      void apiClientes
        // Es un buscador: se pide el máximo porque quien escribe espera ver
        // todo lo que coincide, no los primeros diez.
        .listar({ q: busqueda.trim(), porPagina: 100 })
        .then((pagina) => setResultados(pagina.datos))
        .catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    if (!dia) return;
    const desde = DateTime.fromISO(dia).startOf('day');
    if (!desde.isValid) return;

    setCargandoHuecos(true);
    setHuecoElegido(null);
    void agenda
      .disponibilidad({
        tipo,
        desde: desde.toJSDate(),
        hasta: desde.endOf('day').toJSDate(),
        duracionMin,
        instructorId: instructorId || undefined,
      })
      .then(setHuecos)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargandoHuecos(false));
  }, [dia, tipo, duracionMin, instructorId]);

  async function guardar() {
    if (!alumno || !huecoElegido) return;
    setGuardando(true);
    setError(null);
    try {
      await agenda.crearReserva({
        clienteId: alumno.id,
        instructorId: huecoElegido.instructorId,
        vehiculoId: huecoElegido.vehiculoId,
        tipo,
        inicio: huecoElegido.inicio,
        duracionMin,
        observaciones: observaciones || undefined,
      });
      onCreada();
      onCerrar();
    } catch (problema) {
      setError((problema as Error).message);
      setGuardando(false);
    }
  }

  const habilitados = instructores.filter((i) => (tipo === 'MOTO' ? i.habilitaMoto : i.habilitaAuto));

  return (
    <Modal titulo="Agendar clase" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        {/* Alumno */}
        <Campo etiqueta="Alumno" requerido>
          {alumno ? (
            <div className="mt-1 flex items-center justify-between rounded-lg border border-marca-600 bg-marca-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-900">
                {alumno.nombre} {alumno.apellido}
                {alumno.telefono && <span className="ml-2 text-slate-500">{alumno.telefono}</span>}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAlumno(null);
                  setBusqueda('');
                }}
                className="text-sm text-marca-700 underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por nombre, apellido o cédula"
                className={clasesControl}
              />
              {resultados.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                  {resultados.map((candidato) => (
                    <li key={candidato.id}>
                      <button
                        type="button"
                        onClick={() => setAlumno(candidato)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        {candidato.nombre} {candidato.apellido}
                        {candidato.telefono && (
                          <span className="ml-2 text-slate-500">{candidato.telefono}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {busqueda.trim().length >= 2 && resultados.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Sin resultados. Registralo primero en la sección Alumnos.
                </p>
              )}
            </>
          )}
        </Campo>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Tipo">
            <select
              value={tipo}
              onChange={(evento) => setTipo(evento.target.value as TipoVehiculo)}
              className={clasesControl}
            >
              <option value="AUTO">Auto</option>
              <option value="MOTO">Moto</option>
            </select>
          </Campo>

          <Campo etiqueta="Duración">
            <select
              value={duracionMin}
              onChange={(evento) => setDuracionMin(Number(evento.target.value))}
              className={clasesControl}
            >
              {[30, 45, 60, 90].map((minutos) => (
                <option key={minutos} value={minutos}>
                  {minutos} minutos
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Día">
            <input
              type="date"
              value={dia}
              onChange={(evento) => setDia(evento.target.value)}
              className={clasesControl}
            />
          </Campo>
        </div>

        <Campo etiqueta="Instructor" ayuda="Vacío: cualquiera que esté disponible">
          <select
            value={instructorId}
            onChange={(evento) => setInstructorId(evento.target.value)}
            className={clasesControl}
          >
            <option value="">Cualquiera</option>
            {habilitados.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.nombre} {instructor.apellido}
              </option>
            ))}
          </select>
        </Campo>

        {/* Horarios disponibles */}
        <div>
          <p className="text-sm font-medium text-slate-700">Horarios disponibles</p>
          {cargandoHuecos && <p className="mt-2 text-sm text-slate-500">Buscando…</p>}

          {!cargandoHuecos && huecos.length === 0 && (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              No hay horarios libres ese día con esos criterios. Puede ser por la plantilla del
              instructor, por los vehículos disponibles o por la antelación mínima configurada.
            </p>
          )}

          {huecos.length > 0 && (
            <>
              <p className="mt-1 text-xs text-slate-500">{fechaLarga(huecos[0]!.inicio)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {huecos.map((hueco) => {
                  const elegido = huecoElegido?.inicio === hueco.inicio && huecoElegido?.instructorId === hueco.instructorId;
                  return (
                    <button
                      key={`${hueco.inicio}-${hueco.instructorId}`}
                      type="button"
                      onClick={() => setHuecoElegido(hueco)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        elegido
                          ? 'border-marca-600 bg-marca-50 font-semibold text-marca-900'
                          : 'border-slate-300 hover:border-marca-600'
                      }`}
                    >
                      <span className="block">{hora(hueco.inicio)}</span>
                      <span className="block text-xs text-slate-500">
                        {hueco.instructorNombre} · {hueco.vehiculoPatente}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <Campo etiqueta="Observaciones">
          <input
            type="text"
            value={observaciones}
            onChange={(evento) => setObservaciones(evento.target.value)}
            placeholder="Punto de encuentro, algo a tener en cuenta…"
            className={clasesControl}
          />
        </Campo>

        {error && <Aviso tipo="error">{error}</Aviso>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton disabled={!alumno || !huecoElegido || guardando} onClick={() => void guardar()}>
            {guardando ? 'Agendando…' : 'Agendar clase'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
