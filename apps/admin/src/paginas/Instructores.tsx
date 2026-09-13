import { useCallback, useEffect, useState } from 'react';
import { DateTime } from 'luxon';

import { Modal } from '../componentes/ui/Modal';
import { Paginacion, PAGINA_VACIA, type Pagina } from '../componentes/ui/Paginacion';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import { instructores as api } from '../lib/recursos';
import { DIAS_SEMANA, hhmmAMinutos, minutosAHHMM, fechaYHora } from '../lib/fecha';
import type { Franja, Instructor, TipoExcepcion } from '../lib/tipos';

const FORMULARIO_VACIO = {
  nombre: '',
  apellido: '',
  telefono: '',
  habilitaAuto: true,
  habilitaMoto: false,
  colorAgenda: '#2563eb',
  activo: true,
};

export function Instructores() {
  const [pagina, setPagina] = useState<Pagina<Instructor>>(PAGINA_VACIA as Pagina<Instructor>);
  const [consulta, setConsulta] = useState({ pagina: 1, porPagina: 10 });
  const lista = pagina.datos;
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Instructor | 'nuevo' | null>(null);
  const [horarios, setHorarios] = useState<Instructor | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    void api
      .listar({ incluirInactivos: true, ...consulta })
      .then(setPagina)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, [consulta]);

  useEffect(cargar, [cargar]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Instructores</h1>
        <Boton onClick={() => setEditando('nuevo')}>Nuevo instructor</Boton>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      {cargando && <p className="mt-4 text-slate-500">Cargando…</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Da clases de</th>
              <th className="px-4 py-3 font-medium">Horarios</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((instructor) => (
              <tr key={instructor.id} className={instructor.activo ? '' : 'bg-slate-50 text-slate-400'}>
                <td className="px-4 py-3">
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                    style={{ backgroundColor: instructor.colorAgenda }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-slate-900">
                    {instructor.nombre} {instructor.apellido}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{instructor.telefono ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[instructor.habilitaAuto && 'Auto', instructor.habilitaMoto && 'Moto']
                    .filter(Boolean)
                    .join(' y ') || '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {instructor.disponibilidades?.length
                    ? `${instructor.disponibilidades.length} franjas`
                    : 'sin cargar'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      instructor.activo
                        ? 'rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
                        : 'rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                    }
                  >
                    {instructor.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void api.obtener(instructor.id).then(setHorarios)}
                    className="mr-3 text-marca-600 hover:underline"
                  >
                    Horarios
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(instructor)}
                    className="text-marca-600 hover:underline"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && lista.length === 0 && (
          <p className="p-6 text-center text-slate-500">
            Todavía no hay instructores cargados.
          </p>
        )}
      </div>
      <Paginacion
        pagina={pagina}
        etiqueta="instructores"
        onCambio={(cambios) => setConsulta((actual) => ({ ...actual, ...cambios }))}
      />


      {editando && (
        <FormularioInstructor
          instructor={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}

      {horarios && (
        <EditorHorarios
          instructor={horarios}
          onCerrar={() => setHorarios(null)}
          onGuardado={cargar}
        />
      )}
    </>
  );
}

function FormularioInstructor({
  instructor,
  onCerrar,
  onGuardado,
}: {
  instructor: Instructor | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [datos, setDatos] = useState(
    instructor
      ? {
          nombre: instructor.nombre,
          apellido: instructor.apellido,
          telefono: instructor.telefono ?? '',
          habilitaAuto: instructor.habilitaAuto,
          habilitaMoto: instructor.habilitaMoto,
          colorAgenda: instructor.colorAgenda,
          activo: instructor.activo,
        }
      : FORMULARIO_VACIO,
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    // `activo` se manda SOLO al editar. Al crear, la API no lo acepta —y hace
    // bien: el formulario ni siquiera ofrece el campo cuando se da de alta, y un
    // instructor nuevo nace activo por definición. Mandar el estado entero del
    // formulario incluía ese campo y el alta fallaba con 400.
    const { activo, ...comunes } = datos;
    const cuerpo = {
      ...comunes,
      telefono: datos.telefono || undefined,
      ...(instructor ? { activo } : {}),
    };
    try {
      if (instructor) await api.actualizar(instructor.id, cuerpo);
      else await api.crear(cuerpo);
      onGuardado();
      onCerrar();
    } catch (problema) {
      setError((problema as Error).message);
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={instructor ? 'Editar instructor' : 'Nuevo instructor'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" requerido>
            <input
              value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo etiqueta="Apellido" requerido>
            <input
              value={datos.apellido}
              onChange={(e) => setDatos({ ...datos, apellido: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        <Campo etiqueta="Teléfono">
          <input
            value={datos.telefono}
            onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
            className={clasesControl}
          />
        </Campo>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Da clases de</legend>
          <div className="mt-2 flex gap-4">
            {(['habilitaAuto', 'habilitaMoto'] as const).map((clave) => (
              <label key={clave} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={datos[clave]}
                  onChange={(e) => setDatos({ ...datos, [clave]: e.target.checked })}
                  className="rounded border-slate-300"
                />
                {clave === 'habilitaAuto' ? 'Auto' : 'Moto'}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Color en el calendario">
            <input
              type="color"
              value={datos.colorAgenda}
              onChange={(e) => setDatos({ ...datos, colorAgenda: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300"
            />
          </Campo>
          {instructor && (
            <Campo etiqueta="Estado" ayuda="Un instructor inactivo no aparece en la agenda">
              <select
                value={String(datos.activo)}
                onChange={(e) => setDatos({ ...datos, activo: e.target.value === 'true' })}
                className={clasesControl}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </Campo>
          )}
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton disabled={guardando} onClick={() => void guardar()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Editor de la plantilla semanal y de las excepciones.
 *
 * La plantilla se guarda entera de una vez porque se define como un todo
 * ("estos son mis horarios"), y así no puede quedar a medias.
 */
function EditorHorarios({
  instructor,
  onCerrar,
  onGuardado,
}: {
  instructor: Instructor;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [franjas, setFranjas] = useState<Franja[]>(instructor.disponibilidades ?? []);
  const [excepciones, setExcepciones] = useState(instructor.excepciones ?? []);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [nuevaExcepcion, setNuevaExcepcion] = useState({
    tipo: 'BLOQUEO' as TipoExcepcion,
    inicio: '',
    fin: '',
    motivo: '',
  });

  const agregarFranja = (diaSemana: number) =>
    setFranjas([...franjas, { diaSemana, minutoInicio: 9 * 60, minutoFin: 13 * 60 }]);

  const quitarFranja = (indice: number) =>
    setFranjas(franjas.filter((_, i) => i !== indice));

  const cambiarFranja = (indice: number, campo: 'minutoInicio' | 'minutoFin', valor: string) =>
    setFranjas(franjas.map((f, i) => (i === indice ? { ...f, [campo]: hhmmAMinutos(valor) } : f)));

  async function guardarPlantilla() {
    setGuardando(true);
    setError(null);
    try {
      await api.guardarDisponibilidad(instructor.id, franjas);
      onGuardado();
      onCerrar();
    } catch (problema) {
      setError((problema as Error).message);
      setGuardando(false);
    }
  }

  async function agregarExcepcion() {
    setError(null);
    try {
      const creada = await api.crearExcepcion(instructor.id, {
        tipo: nuevaExcepcion.tipo,
        inicio: DateTime.fromISO(nuevaExcepcion.inicio).toUTC().toISO() ?? '',
        fin: DateTime.fromISO(nuevaExcepcion.fin).toUTC().toISO() ?? '',
        motivo: nuevaExcepcion.motivo || null,
      });
      setExcepciones([...excepciones, creada]);
      setNuevaExcepcion({ tipo: 'BLOQUEO', inicio: '', fin: '', motivo: '' });
    } catch (problema) {
      setError((problema as Error).message);
    }
  }

  async function quitarExcepcion(id: string) {
    setError(null);
    try {
      await api.eliminarExcepcion(instructor.id, id);
      setExcepciones(excepciones.filter((e) => e.id !== id));
    } catch (problema) {
      setError((problema as Error).message);
    }
  }

  return (
    <Modal
      titulo={`Horarios de ${instructor.nombre} ${instructor.apellido}`}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
    >
      <section>
        <h3 className="font-semibold text-slate-900">Plantilla semanal</h3>
        <p className="mt-1 text-sm text-slate-600">
          Los horarios habituales. Sobre esta base se calculan los turnos disponibles.
        </p>

        <div className="mt-3 space-y-2">
          {DIAS_SEMANA.map((nombre, dia) => {
            const delDia = franjas
              .map((franja, indice) => ({ franja, indice }))
              .filter((f) => f.franja.diaSemana === dia);

            return (
              <div key={dia} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-24 shrink-0 text-sm font-medium text-slate-700">{nombre}</span>

                {delDia.map(({ franja, indice }) => (
                  <span key={indice} className="flex items-center gap-1">
                    <input
                      type="time"
                      value={minutosAHHMM(franja.minutoInicio)}
                      onChange={(e) => cambiarFranja(indice, 'minutoInicio', e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                    <span className="text-slate-400">a</span>
                    <input
                      type="time"
                      value={minutosAHHMM(franja.minutoFin)}
                      onChange={(e) => cambiarFranja(indice, 'minutoFin', e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => quitarFranja(indice)}
                      className="px-1 text-slate-400 hover:text-red-600"
                      aria-label={`Quitar franja del ${nombre}`}
                    >
                      ×
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={() => agregarFranja(dia)}
                  className="text-sm text-marca-600 hover:underline"
                >
                  + agregar
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <Boton disabled={guardando} onClick={() => void guardarPlantilla()}>
            {guardando ? 'Guardando…' : 'Guardar plantilla'}
          </Boton>
        </div>
      </section>

      <section className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="font-semibold text-slate-900">Excepciones</h3>
        <p className="mt-1 text-sm text-slate-600">
          Licencias y feriados quitan horarios; una disponibilidad extra agrega turnos fuera de
          la plantilla.
        </p>

        <ul className="mt-3 space-y-1">
          {excepciones.map((excepcion) => (
            <li
              key={excepcion.id}
              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <span>
                <strong className={excepcion.tipo === 'BLOQUEO' ? 'text-red-700' : 'text-green-700'}>
                  {excepcion.tipo === 'BLOQUEO' ? 'Bloqueo' : 'Extra'}
                </strong>{' '}
                {fechaYHora(excepcion.inicio)} → {fechaYHora(excepcion.fin)}
                {excepcion.motivo && <span className="text-slate-500"> · {excepcion.motivo}</span>}
              </span>
              <button
                type="button"
                onClick={() => void quitarExcepcion(excepcion.id)}
                className="text-slate-400 hover:text-red-600"
                aria-label="Quitar excepción"
              >
                ×
              </button>
            </li>
          ))}
          {excepciones.length === 0 && <li className="text-sm text-slate-500">Sin excepciones.</li>}
        </ul>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <select
            value={nuevaExcepcion.tipo}
            onChange={(e) =>
              setNuevaExcepcion({ ...nuevaExcepcion, tipo: e.target.value as TipoExcepcion })
            }
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="BLOQUEO">Bloqueo</option>
            <option value="DISPONIBILIDAD_EXTRA">Extra</option>
          </select>
          <input
            type="datetime-local"
            value={nuevaExcepcion.inicio}
            onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, inicio: e.target.value })}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            type="datetime-local"
            value={nuevaExcepcion.fin}
            onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, fin: e.target.value })}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            value={nuevaExcepcion.motivo}
            onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, motivo: e.target.value })}
            placeholder="Motivo"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Boton
            variante="secundario"
            disabled={!nuevaExcepcion.inicio || !nuevaExcepcion.fin}
            onClick={() => void agregarExcepcion()}
          >
            Agregar excepción
          </Boton>
        </div>
      </section>

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
    </Modal>
  );
}
