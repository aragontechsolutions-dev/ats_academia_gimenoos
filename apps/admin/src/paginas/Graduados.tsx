import { useCallback, useEffect, useState } from 'react';

import { Modal } from '../componentes/ui/Modal';
import { Paginacion, PAGINA_VACIA, type Pagina } from '../componentes/ui/Paginacion';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import { DiplomaImprimible } from '../componentes/DiplomaImprimible';
import { CeldaFoto } from '../componentes/CeldaFoto';
import { graduados as api, clientes as apiClientes } from '../lib/recursos';
import { hoyEnMontevideo } from '../lib/fecha';
import { useAvisos } from '../lib/avisos';
import type { Cliente, Graduado } from '../lib/tipos';

const SITIO_URL = import.meta.env.VITE_SITIO_URL ?? 'academiagimenoos.com.uy';

const CATEGORIAS = [
  { valor: 'A', texto: 'A — Automóvil' },
  { valor: 'G1', texto: 'G1 — Ciclomotor' },
  { valor: 'G2', texto: 'G2 — Motocicleta' },
] as const;

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${iso.slice(0, 10)}T12:00:00`),
  );

export function Graduados() {
  const avisos = useAvisos();
  const [pagina, setPagina] = useState<Pagina<Graduado>>(PAGINA_VACIA as Pagina<Graduado>);
  const [consulta, setConsulta] = useState({ pagina: 1, porPagina: 10 });
  const [resumen, setResumen] = useState<{ sinAutorizacion: number; anios: number[] }>({
    sinAutorizacion: 0,
    anios: [],
  });
  const lista = pagina.datos;
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anio, setAnio] = useState<string>('');
  const [nuevo, setNuevo] = useState(false);
  const [imprimiendo, setImprimiendo] = useState<Graduado | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    void api
      .listar({ anio: anio ? Number(anio) : undefined, ...consulta })
      .then(setPagina)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));

    // El aviso de "faltan autorizaciones" cuenta sobre TODOS los egresados, no
    // sobre la página que se está viendo: si no, avisaría distinto según en qué
    // página esté parado quien mira.
    void api.resumen().then(setResumen).catch(() => undefined);
  }, [anio, consulta]);

  useEffect(cargar, [cargar]);

  const { anios, sinAutorizacion } = resumen;

  // `hecho` viaja junto al botón: cada acción avisa lo que hizo, no un «listo»
  // que obliga a recordar qué se tocó. Si mañana se agrega una acción sin texto,
  // no compila.
  const accion = (promesa: Promise<unknown>, hecho: string) => {
    void promesa
      .then(() => {
        avisos.exito(hecho);
        cargar();
      })
      .catch((problema: unknown) => avisos.error(problema));
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Egresados</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cada egresado recibe su diploma. La foto para la galería se saca sosteniendo el
            diploma, nunca la libreta: la libreta muestra el documento y la fecha de nacimiento.
          </p>
        </div>
        <Boton onClick={() => setNuevo(true)}>Registrar egresado</Boton>
      </div>

      {sinAutorizacion > 0 && (
        <div className="mt-4">
          <Aviso>
            {sinAutorizacion === 1
              ? 'Hay 1 egresado sin autorización firmada.'
              : `Hay ${sinAutorizacion} egresados sin autorización firmada.`}{' '}
            Su diploma se puede emitir igual, pero no pueden aparecer en la galería del sitio
            hasta que la firma esté cargada.
          </Aviso>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <label htmlFor="filtro-anio" className="text-sm text-slate-600">
          Año
        </label>
        <select
          id="filtro-anio"
          value={anio}
          onChange={(evento) => setAnio(evento.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {cargando && <p className="mt-6 text-slate-500">Cargando…</p>}

      {!cargando && lista.length === 0 && (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          Todavía no hay egresados registrados.
        </p>
      )}

      {lista.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">Alumno</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Egreso</th>
                <th className="px-4 py-3">Autorización</th>
                <th className="px-4 py-3">Galería</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((graduado) => (
                <tr key={graduado.id}>
                  <td className="px-4 py-3">
                    <CeldaFoto
                      bucket="graduados"
                      duenoId={graduado.id}
                      ruta={graduado.fotoRuta}
                      descripcion={`${graduado.cliente.nombre} ${graduado.cliente.apellido}`}
                      guardar={(fotoRuta) => api.actualizar(graduado.id, { fotoRuta })}
                      onCambio={cargar}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {graduado.cliente.nombre} {graduado.cliente.apellido}
                  </td>
                  <td className="px-4 py-3">{graduado.categoria}</td>
                  <td className="px-4 py-3">{fecha(graduado.fechaEgreso)}</td>
                  <td className="px-4 py-3">
                    {graduado.autorizacionAt ? (
                      <span className="text-green-700">
                        Firmada
                        {graduado.autorizacionEsTutor && ' (tutor)'}
                      </span>
                    ) : (
                      <span className="text-amber-700">Falta</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {graduado.publicado ? (
                      <span className="text-slate-900">Publicado</span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{graduado.codigo}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setImprimiendo(graduado)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-400"
                      >
                        Diploma
                      </button>

                      {graduado.autorizacionAt && (
                        <button
                          type="button"
                          onClick={() =>
                            accion(
                              api.actualizar(graduado.id, { publicado: !graduado.publicado }),
                              graduado.publicado
                                ? 'Egresado quitado de la galería'
                                : 'Egresado publicado en la galería',
                            )
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-marca-500 hover:text-marca-700"
                        >
                          {graduado.publicado ? 'Quitar de la galería' : 'Publicar'}
                        </button>
                      )}

                      {graduado.autorizacionAt && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Retirar la autorización de ${graduado.cliente.nombre}? Sale de la galería del sitio.`,
                              )
                            ) {
                              accion(api.retirarAutorizacion(graduado.id), 'Autorización retirada');
                            }
                          }}
                          className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-800 hover:bg-amber-50"
                        >
                          Retirar permiso
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Borrar definitivamente el egreso de ${graduado.cliente.nombre}? No se puede deshacer.`,
                            )
                          ) {
                            accion(api.eliminar(graduado.id), 'Egreso borrado');
                          }
                        }}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion
        pagina={pagina}
        etiqueta="egresados"
        onCambio={(cambios) => setConsulta((actual) => ({ ...actual, ...cambios }))}
      />


      {nuevo && (
        <FormularioEgresado
          onCerrar={() => setNuevo(false)}
          onGuardado={() => {
            setNuevo(false);
            cargar();
          }}
        />
      )}

      {imprimiendo && (
        <DiplomaImprimible
          graduado={imprimiendo}
          sitioUrl={SITIO_URL.replace(/^https?:\/\//, '')}
          onCerrar={() => setImprimiendo(null)}
        />
      )}
    </>
  );
}

function FormularioEgresado({
  onCerrar,
  onGuardado,
}: {
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [alumnos, setAlumnos] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [categoria, setCategoria] = useState<string>('A');
  // `hoyEnMontevideo()` y no `new Date().toISOString().slice(0, 10)`: ese recorte
  // da la fecha en UTC, y de las nueve de la noche en adelante Uruguay ya está en
  // el día anterior al de UTC. El formulario se abría con la fecha de MAÑANA, que
  // es justo el error que reportó la academia una noche a las diez y media.
  const [fechaEgreso, setFechaEgreso] = useState(hoyEnMontevideo);
  const [tieneAutorizacion, setTieneAutorizacion] = useState(false);
  const [autorizacionAt, setAutorizacionAt] = useState(hoyEnMontevideo);
  const [esTutor, setEsTutor] = useState(false);
  const [firmante, setFirmante] = useState('');
  const [guardando, setGuardando] = useState(false);
  const avisos = useAvisos();

  useEffect(() => {
    // Desplegable: necesita la lista completa, no una página.
    void apiClientes
      .listar({ porPagina: 100 })
      .then((pagina) => setAlumnos(pagina.datos))
      .catch(() => setAlumnos([]));
  }, []);

  const guardar = () => {
    setGuardando(true);
    void api
      .crear({
        clienteId,
        categoria,
        fechaEgreso,
        ...(tieneAutorizacion
          ? {
              autorizacionAt,
              autorizacionFirmante: firmante || 'El propio alumno',
              autorizacionEsTutor: esTutor,
            }
          : {}),
      })
      .then(() => {
        avisos.exito('Egresado registrado');
        onGuardado();
      })
      .catch((problema: unknown) => avisos.error(problema))
      .finally(() => setGuardando(false));
  };

  return (
    <Modal titulo="Registrar egresado" onCerrar={onCerrar}>
      <div className="space-y-4">
        <Campo etiqueta="Alumno" requerido>
          <select
            value={clienteId}
            onChange={(evento) => setClienteId(evento.target.value)}
            className={clasesControl}
          >
            <option value="">Elegí un alumno</option>
            {alumnos.map((alumno) => (
              <option key={alumno.id} value={alumno.id}>
                {alumno.apellido}, {alumno.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Categoría" requerido>
          <select
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value)}
            className={clasesControl}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.texto}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Fecha de egreso" requerido>
          <input
            type="date"
            value={fechaEgreso}
            onChange={(evento) => setFechaEgreso(evento.target.value)}
            className={clasesControl}
          />
        </Campo>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={tieneAutorizacion}
              onChange={(evento) => setTieneAutorizacion(evento.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-slate-900">
                Tengo la autorización firmada para publicar su foto
              </span>
              <span className="mt-1 block text-xs text-slate-600">
                Sin esto el diploma se emite igual, pero el egresado no puede aparecer en la
                galería del sitio. El sistema lo impide.
              </span>
            </span>
          </label>

          {tieneAutorizacion && (
            <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
              <Campo etiqueta="Fecha de la firma">
                <input
                  type="date"
                  value={autorizacionAt}
                  onChange={(evento) => setAutorizacionAt(evento.target.value)}
                  className={clasesControl}
                />
              </Campo>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={esTutor}
                  onChange={(evento) => setEsTutor(evento.target.checked)}
                  className="h-4 w-4"
                />
                Es menor de 18: firmó su padre, madre o tutor
              </label>

              <Campo
                etiqueta={esTutor ? 'Nombre de quien firmó' : 'Quién firmó'}
                ayuda={esTutor ? 'Obligatorio: tiene que constar quién dio el consentimiento.' : undefined}
                requerido={esTutor}
              >
                <input
                  value={firmante}
                  placeholder={esTutor ? 'Nombre del padre, madre o tutor' : 'El propio alumno'}
                  onChange={(evento) => setFirmante(evento.target.value)}
                  className={clasesControl}
                />
              </Campo>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
        >
          Cancelar
        </button>
        <Boton onClick={guardar} disabled={guardando || !clienteId}>
          {guardando ? 'Guardando…' : 'Registrar y emitir diploma'}
        </Boton>
      </div>
    </Modal>
  );
}
