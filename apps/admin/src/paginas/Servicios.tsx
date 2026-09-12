import { useEffect, useState } from 'react';
import { llamarApi } from '../lib/api';

interface Servicio {
  id: string;
  nombre: string;
  tipo: string;
  tipoVehiculo: string | null;
  cantidadClases: number;
  duracionMin: number;
  precioContado: string;
  precioTarjeta: string;
  activo: boolean;
  publico: boolean;
}

const formateador = new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency: 'UYU',
  maximumFractionDigits: 0,
});

export function Servicios() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    void llamarApi<Servicio[]>('/catalogo/servicios/todos')
      .then(setServicios)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Servicios y precios</h1>
      <p className="mt-2 text-slate-600">
        Estos son los servicios del catálogo. La edición desde el panel se agrega en la Etapa 1;
        por ahora se cargan con el seed de la base.
      </p>

      {cargando && <p className="mt-6 text-slate-500">Cargando…</p>}
      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      {!cargando && !error && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Vehículo</th>
                <th className="px-4 py-3 font-medium">Clases</th>
                <th className="px-4 py-3 text-right font-medium">Contado</th>
                <th className="px-4 py-3 text-right font-medium">Tarjeta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {servicios.map((servicio) => (
                <tr key={servicio.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{servicio.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{servicio.tipoVehiculo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{servicio.cantidadClases}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formateador.format(Number(servicio.precioContado))}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formateador.format(Number(servicio.precioTarjeta))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        servicio.activo
                          ? 'rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
                          : 'rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                      }
                    >
                      {servicio.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
