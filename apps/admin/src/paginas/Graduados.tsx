import { useCallback, useEffect, useRef, useState } from 'react';

import { Modal } from '../componentes/ui/Modal';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import { DiplomaImprimible } from '../componentes/DiplomaImprimible';
import { graduados as api, clientes as apiClientes } from '../lib/recursos';
import { borrarFotoGraduado, subirFotoGraduado } from '../lib/fotos';
import { enKb } from '../lib/imagen';
import type { Cliente, Graduado } from '../lib/tipos';

const SITIO_URL = import.meta.env.VITE_SITIO_URL ?? 'academiagimenoos.com.uy';
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');

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
  const [lista, setLista] = useState<Graduado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anio, setAnio] = useState<string>('');
  const [nuevo, setNuevo] = useState(false);
  const [imprimiendo, setImprimiendo] = useState<Graduado | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    void api
      .listar({ anio: anio ? Number(anio) : undefined })
      .then(setLista)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, [anio]);

  useEffect(cargar, [cargar]);

  const anios = [...new Set(lista.map((g) => g.anio))].sort((a, b) => b - a);
  const sinAutorizacion = lista.filter((g) => !g.autorizacionAt);

  const accion = (promesa: Promise<unknown>) => {
    void promesa.then(cargar).catch((problema: Error) => setError(problema.message));
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

      {sinAutorizacion.length > 0 && (
        <div className="mt-4">
          <Aviso>
            {sinAutorizacion.length === 1
              ? 'Hay 1 egresado sin autorización firmada.'
              : `Hay ${sinAutorizacion.length} egresados sin autorización firmada.`}{' '}
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
                    <CeldaFoto graduado={graduado} onCambio={cargar} onError={setError} />
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
                              accion(api.retirarAutorizacion(graduado.id));
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
                            accion(api.eliminar(graduado.id));
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
  const [fechaEgreso, setFechaEgreso] = useState(() => new Date().toISOString().slice(0, 10));
  const [tieneAutorizacion, setTieneAutorizacion] = useState(false);
  const [autorizacionAt, setAutorizacionAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [esTutor, setEsTutor] = useState(false);
  const [firmante, setFirmante] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiClientes.listar().then(setAlumnos).catch(() => setAlumnos([]));
  }, []);

  const guardar = () => {
    setGuardando(true);
    setError(null);
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
      .then(onGuardado)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setGuardando(false));
  };

  return (
    <Modal titulo="Registrar egresado" onCerrar={onCerrar}>
      {error && (
        <div className="mb-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

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

/**
 * La foto del egresado: subir, reemplazar y quitar.
 *
 * La imagen se reduce y se re-codifica en el navegador antes de salir, lo que le
 * quita los metadatos de la cámara —incluida la ubicación GPS—. Subir la foto
 * tal cual sale del celular publicaría esas coordenadas en un archivo que
 * cualquiera puede descargar.
 */
function CeldaFoto({
  graduado,
  onCambio,
  onError,
}: {
  graduado: Graduado;
  onCambio: () => void;
  onError: (mensaje: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const urlPublica = graduado.fotoRuta
    ? `${SUPABASE_URL}/storage/v1/object/public/graduados/${graduado.fotoRuta}`
    : null;

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    const anterior = graduado.fotoRuta;

    try {
      const { ruta, imagen } = await subirFotoGraduado(graduado.id, archivo);
      await api.actualizar(graduado.id, { fotoRuta: ruta });

      // La anterior se borra DESPUÉS de que la nueva quedó guardada: si algo
      // falla en el medio, el egresado se queda con su foto vieja y no sin
      // ninguna.
      if (anterior) await borrarFotoGraduado(anterior).catch(() => undefined);

      console.info(
        `Foto de ${graduado.cliente.nombre}: ${enKb(imagen.bytesOriginal)} -> ${enKb(imagen.bytes)}`,
      );
      onCambio();
    } catch (problema) {
      onError((problema as Error).message);
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const quitar = async () => {
    if (!graduado.fotoRuta) return;
    if (!window.confirm(`¿Quitar la foto de ${graduado.cliente.nombre}?`)) return;

    setSubiendo(true);
    try {
      await api.actualizar(graduado.id, { fotoRuta: '' });
      await borrarFotoGraduado(graduado.fotoRuta);
      onCambio();
    } catch (problema) {
      onError((problema as Error).message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {urlPublica ? (
        <img
          src={urlPublica}
          alt={`Foto de ${graduado.cliente.nombre} ${graduado.cliente.apellido}`}
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400"
        >
          —
        </div>
      )}

      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={subiendo}
          onClick={() => entrada.current?.click()}
          className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:border-marca-500 hover:text-marca-700 disabled:opacity-50"
        >
          {subiendo ? 'Subiendo…' : graduado.fotoRuta ? 'Cambiar' : 'Subir'}
        </button>
        {graduado.fotoRuta && !subiendo && (
          <button
            type="button"
            onClick={() => void quitar()}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-red-400 hover:text-red-600"
          >
            Quitar
          </button>
        )}
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(evento) => void elegir(evento.target.files?.[0])}
      />
    </div>
  );
}
