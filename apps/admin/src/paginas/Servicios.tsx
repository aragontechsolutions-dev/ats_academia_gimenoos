import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../componentes/ui/Modal';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import { servicios as api } from '../lib/recursos';
import type { Servicio, TipoServicio, TipoVehiculo } from '../lib/tipos';

const formateador = new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency: 'UYU',
  maximumFractionDigits: 0,
});

const ETIQUETA_TIPO: Record<TipoServicio, string> = {
  CLASE_SUELTA: 'Clase suelta',
  PACK: 'Pack',
  CURSO_COMPLETO: 'Curso completo',
  GESTORIA: 'Gestoría',
};

/** Un precio en cero todavía no fue cargado: la landing muestra "Consultanos". */
const precio = (valor: string) => (Number(valor) > 0 ? formateador.format(Number(valor)) : '—');

export function Servicios() {
  const [lista, setLista] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Servicio | 'nuevo' | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    void api
      .listar()
      .then(setLista)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  const sinPrecio = lista.filter((s) => Number(s.precioContado) === 0 && s.activo && s.publico);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Servicios y precios</h1>
        <Boton onClick={() => setEditando('nuevo')}>Nuevo servicio</Boton>
      </div>

      {sinPrecio.length > 0 && (
        <div className="mt-4">
          <Aviso>
            {sinPrecio.length === 1 ? 'Hay 1 servicio publicado' : `Hay ${sinPrecio.length} servicios publicados`}{' '}
            sin precio cargado. En el sitio aparecen como «Consultanos el precio».
          </Aviso>
        </div>
      )}

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
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Clases</th>
              <th className="px-4 py-3 text-right font-medium">Contado</th>
              <th className="px-4 py-3 text-right font-medium">Tarjeta</th>
              <th className="px-4 py-3 font-medium">En el sitio</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((servicio) => (
              <tr key={servicio.id} className={servicio.activo ? '' : 'bg-slate-50 text-slate-400'}>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">{servicio.nombre}</span>
                  {servicio.tipoVehiculo && (
                    <span className="ml-2 text-xs text-slate-500">
                      {servicio.tipoVehiculo.toLowerCase()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{ETIQUETA_TIPO[servicio.tipo]}</td>
                <td className="px-4 py-3 text-slate-600">
                  {servicio.cantidadClases > 0 ? `${servicio.cantidadClases} × ${servicio.duracionMin}′` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-900">{precio(servicio.precioContado)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{precio(servicio.precioTarjeta)}</td>
                <td className="px-4 py-3">
                  {servicio.activo && servicio.publico ? (
                    <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      Visible
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Oculto
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditando(servicio)}
                    className="text-marca-600 hover:underline"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <FormularioServicio
          servicio={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}
    </>
  );
}

function FormularioServicio({
  servicio,
  onCerrar,
  onGuardado,
}: {
  servicio: Servicio | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [datos, setDatos] = useState({
    slug: servicio?.slug ?? '',
    nombre: servicio?.nombre ?? '',
    descripcion: servicio?.descripcion ?? '',
    tipo: (servicio?.tipo ?? 'CLASE_SUELTA') as TipoServicio,
    tipoVehiculo: (servicio?.tipoVehiculo ?? 'AUTO') as TipoVehiculo | '',
    cantidadClases: servicio?.cantidadClases?.toString() ?? '1',
    duracionMin: servicio?.duracionMin?.toString() ?? '45',
    precioContado: servicio?.precioContado ?? '0',
    precioTarjeta: servicio?.precioTarjeta ?? '0',
    orden: servicio?.orden?.toString() ?? '0',
    activo: servicio?.activo ?? true,
    publico: servicio?.publico ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /** El slug se sugiere a partir del nombre, pero no se toca si ya existe. */
  const alCambiarNombre = (nombre: string) =>
    setDatos((actual) => ({
      ...actual,
      nombre,
      slug: servicio
        ? actual.slug
        : nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
    }));

  async function guardar() {
    setGuardando(true);
    setError(null);
    const cuerpo = {
      slug: datos.slug,
      nombre: datos.nombre,
      descripcion: datos.descripcion || undefined,
      tipo: datos.tipo,
      tipoVehiculo: datos.tipoVehiculo || undefined,
      cantidadClases: Number(datos.cantidadClases),
      duracionMin: Number(datos.duracionMin),
      precioContado: Number(datos.precioContado),
      precioTarjeta: Number(datos.precioTarjeta),
      orden: Number(datos.orden),
      activo: datos.activo,
      publico: datos.publico,
    };
    try {
      if (servicio) await api.actualizar(servicio.id, cuerpo);
      else await api.crear(cuerpo);
      onGuardado();
      onCerrar();
    } catch (problema) {
      setError((problema as Error).message);
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={servicio ? 'Editar servicio' : 'Nuevo servicio'} onCerrar={onCerrar} ancho="max-w-xl">
      <div className="space-y-4">
        <Campo etiqueta="Nombre" requerido>
          <input
            value={datos.nombre}
            onChange={(e) => alCambiarNombre(e.target.value)}
            className={clasesControl}
          />
        </Campo>

        <Campo etiqueta="Identificador" ayuda="Se usa en los enlaces. Minúsculas y guiones.">
          <input
            value={datos.slug}
            onChange={(e) => setDatos({ ...datos, slug: e.target.value })}
            className={clasesControl}
          />
        </Campo>

        <Campo etiqueta="Descripción">
          <textarea
            value={datos.descripcion}
            onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
            rows={2}
            className={clasesControl}
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tipo">
            <select
              value={datos.tipo}
              onChange={(e) => setDatos({ ...datos, tipo: e.target.value as TipoServicio })}
              className={clasesControl}
            >
              {(Object.keys(ETIQUETA_TIPO) as TipoServicio[]).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETA_TIPO[tipo]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Vehículo" ayuda="Vacío si no involucra vehículo">
            <select
              value={datos.tipoVehiculo}
              onChange={(e) =>
                setDatos({ ...datos, tipoVehiculo: e.target.value as TipoVehiculo | '' })
              }
              className={clasesControl}
            >
              <option value="">Ninguno</option>
              <option value="AUTO">Auto</option>
              <option value="MOTO">Moto</option>
            </select>
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Cantidad de clases">
            <input
              type="number"
              min={0}
              value={datos.cantidadClases}
              onChange={(e) => setDatos({ ...datos, cantidadClases: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo etiqueta="Duración de cada clase" ayuda="En minutos">
            <input
              type="number"
              min={0}
              value={datos.duracionMin}
              onChange={(e) => setDatos({ ...datos, duracionMin: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Precio contado o transferencia" requerido>
            <input
              type="number"
              min={0}
              step="1"
              value={datos.precioContado}
              onChange={(e) => setDatos({ ...datos, precioContado: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo etiqueta="Precio con tarjeta" requerido>
            <input
              type="number"
              min={0}
              step="1"
              value={datos.precioTarjeta}
              onChange={(e) => setDatos({ ...datos, precioTarjeta: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={datos.activo}
              onChange={(e) => setDatos({ ...datos, activo: e.target.checked })}
              className="rounded border-slate-300"
            />
            Activo
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={datos.publico}
              onChange={(e) => setDatos({ ...datos, publico: e.target.checked })}
              className="rounded border-slate-300"
            />
            Mostrar en el sitio público
          </label>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton disabled={guardando || !datos.nombre || !datos.slug} onClick={() => void guardar()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
