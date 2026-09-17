import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../componentes/ui/Modal';
import { Paginacion, PAGINA_VACIA, type Pagina } from '../componentes/ui/Paginacion';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import { CeldaFoto } from '../componentes/CeldaFoto';
import { vehiculos as api } from '../lib/recursos';
import { useAvisos } from '../lib/avisos';
import { fechaCorta } from '../lib/fecha';
import type { EstadoVehiculo, TipoVehiculo, Vehiculo } from '../lib/tipos';

const ETIQUETA_ESTADO: Record<EstadoVehiculo, string> = {
  ACTIVO: 'Activo',
  MANTENIMIENTO: 'En mantenimiento',
  BAJA: 'De baja',
};

export function Vehiculos() {
  const [pagina, setPagina] = useState<Pagina<Vehiculo>>(PAGINA_VACIA as Pagina<Vehiculo>);
  const [consulta, setConsulta] = useState({ pagina: 1, porPagina: 10 });
  const lista = pagina.datos;
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Vehiculo | 'nuevo' | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    void api
      .listar({ incluirInactivos: true, ...consulta })
      .then(setPagina)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, [consulta]);

  useEffect(cargar, [cargar]);

  const hoy = new Date();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Vehículos</h1>
        <Boton onClick={() => setEditando('nuevo')}>Nuevo vehículo</Boton>
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
              <th className="px-4 py-3 font-medium">Foto</th>
              <th className="px-4 py-3 font-medium">Patente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Vehículo</th>
              <th className="px-4 py-3 font-medium">SOA</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((vehiculo) => {
              const soaVencido = vehiculo.soaVence && new Date(vehiculo.soaVence) < hoy;
              return (
                <tr key={vehiculo.id} className={vehiculo.estado === 'ACTIVO' ? '' : 'bg-slate-50'}>
                  <td className="px-4 py-3">
                    <CeldaFoto
                      bucket="vehiculos"
                      duenoId={vehiculo.id}
                      ruta={vehiculo.fotoRuta}
                      descripcion={`${vehiculo.tipo === 'MOTO' ? 'la moto' : 'el auto'} ${vehiculo.patente}`}
                      guardar={(fotoRuta) => api.guardarFoto(vehiculo.id, fotoRuta)}
                      onCambio={cargar}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{vehiculo.patente}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {vehiculo.tipo === 'MOTO' ? 'Moto' : 'Auto'}
                    {vehiculo.cilindrada && <span className="text-slate-400"> · {vehiculo.cilindrada}cc</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {vehiculo.soaVence ? (
                      <span className={soaVencido ? 'font-medium text-red-700' : 'text-slate-600'}>
                        {fechaCorta(vehiculo.soaVence)}
                        {soaVencido && ' (vencido)'}
                      </span>
                    ) : (
                      <span className="text-slate-400">sin cargar</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        vehiculo.estado === 'ACTIVO'
                          ? 'rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
                          : 'rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                      }
                    >
                      {ETIQUETA_ESTADO[vehiculo.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditando(vehiculo)}
                      className="text-marca-600 hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!cargando && lista.length === 0 && (
          <p className="p-6 text-center text-slate-500">Todavía no hay vehículos cargados.</p>
        )}
      </div>
      <Paginacion
        pagina={pagina}
        etiqueta="vehículos"
        onCambio={(cambios) => setConsulta((actual) => ({ ...actual, ...cambios }))}
      />


      {editando && (
        <FormularioVehiculo
          vehiculo={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}
    </>
  );
}

function FormularioVehiculo({
  vehiculo,
  onCerrar,
  onGuardado,
}: {
  vehiculo: Vehiculo | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [datos, setDatos] = useState({
    patente: vehiculo?.patente ?? '',
    tipo: (vehiculo?.tipo ?? 'AUTO') as TipoVehiculo,
    marca: vehiculo?.marca ?? '',
    modelo: vehiculo?.modelo ?? '',
    cilindrada: vehiculo?.cilindrada?.toString() ?? '',
    anio: vehiculo?.anio?.toString() ?? '',
    soaVence: vehiculo?.soaVence?.slice(0, 10) ?? '',
    estado: (vehiculo?.estado ?? 'ACTIVO') as EstadoVehiculo,
  });
  const avisos = useAvisos();
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const cuerpo = {
      patente: datos.patente.toUpperCase().replace(/[\s-]/g, ''),
      tipo: datos.tipo,
      marca: datos.marca || undefined,
      modelo: datos.modelo || undefined,
      cilindrada: datos.cilindrada ? Number(datos.cilindrada) : undefined,
      anio: datos.anio ? Number(datos.anio) : undefined,
      soaVence: datos.soaVence || undefined,
      ...(vehiculo ? { estado: datos.estado } : {}),
    };
    try {
      if (vehiculo) await api.actualizar(vehiculo.id, cuerpo);
      else await api.crear(cuerpo);
      avisos.exito(vehiculo ? 'Vehículo actualizado' : 'Vehículo creado');
      onGuardado();
      onCerrar();
    } catch (problema) {
      avisos.error(problema);
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={vehiculo ? 'Editar vehículo' : 'Nuevo vehículo'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Patente" requerido ayuda="Sin espacios ni guiones">
            <input
              value={datos.patente}
              onChange={(e) => setDatos({ ...datos, patente: e.target.value })}
              className={`${clasesControl} uppercase`}
            />
          </Campo>
          <Campo etiqueta="Tipo" requerido>
            <select
              value={datos.tipo}
              onChange={(e) => setDatos({ ...datos, tipo: e.target.value as TipoVehiculo })}
              className={clasesControl}
            >
              <option value="AUTO">Auto</option>
              <option value="MOTO">Moto</option>
            </select>
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Marca">
            <input
              value={datos.marca}
              onChange={(e) => setDatos({ ...datos, marca: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo etiqueta="Modelo">
            <input
              value={datos.modelo}
              onChange={(e) => setDatos({ ...datos, modelo: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Cilindrada" ayuda="En cc, para motos">
            <input
              type="number"
              value={datos.cilindrada}
              onChange={(e) => setDatos({ ...datos, cilindrada: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo etiqueta="Año">
            <input
              type="number"
              value={datos.anio}
              onChange={(e) => setDatos({ ...datos, anio: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo etiqueta="Vence el SOA">
            <input
              type="date"
              value={datos.soaVence}
              onChange={(e) => setDatos({ ...datos, soaVence: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        {vehiculo && (
          <Campo
            etiqueta="Estado"
            ayuda="Mantenimiento y baja lo sacan de los horarios disponibles"
          >
            <select
              value={datos.estado}
              onChange={(e) => setDatos({ ...datos, estado: e.target.value as EstadoVehiculo })}
              className={clasesControl}
            >
              <option value="ACTIVO">Activo</option>
              <option value="MANTENIMIENTO">En mantenimiento</option>
              <option value="BAJA">De baja</option>
            </select>
          </Campo>
        )}


        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton disabled={guardando || !datos.patente} onClick={() => void guardar()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
