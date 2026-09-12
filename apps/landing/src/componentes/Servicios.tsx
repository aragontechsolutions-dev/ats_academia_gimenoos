import { useEffect, useState } from 'react';
import { obtenerServicios, type ServicioPublico } from '../lib/api';

const formateador = new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency: 'UYU',
  maximumFractionDigits: 0,
});

/**
 * Un precio en 0 significa "todavia no cargado en el panel".
 * En ese caso se muestra "Consultanos" en vez de publicar un precio incorrecto.
 */
function formatearPrecio(valor: string): string | null {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return formateador.format(numero);
}

export function Servicios() {
  const [servicios, setServicios] = useState<ServicioPublico[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    void obtenerServicios().then((datos) => {
      if (!vigente) return;
      setServicios(datos);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <section id="servicios" className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900">Clases y precios</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Precios actualizados por la academia. El valor de contado o transferencia puede
          diferir del valor con tarjeta.
        </p>

        {cargando && <p className="mt-8 text-slate-500">Cargando precios…</p>}

        {!cargando && servicios.length === 0 && (
          <p className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            En este momento no podemos mostrar el listado de precios.{' '}
            <a href="#contacto" className="font-semibold text-marca-600 underline">
              Consultanos y te lo pasamos.
            </a>
          </p>
        )}

        {servicios.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servicios.map((servicio) => {
              const contado = formatearPrecio(servicio.precioContado);
              const tarjeta = formatearPrecio(servicio.precioTarjeta);

              return (
                <article
                  key={servicio.id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-6"
                >
                  <h3 className="text-lg font-semibold text-slate-900">{servicio.nombre}</h3>
                  {servicio.descripcion && (
                    <p className="mt-2 flex-1 text-sm text-slate-600">{servicio.descripcion}</p>
                  )}

                  <dl className="mt-4 border-t border-slate-100 pt-4 text-sm">
                    {contado ? (
                      <div className="flex items-baseline justify-between">
                        <dt className="text-slate-500">Contado o transferencia</dt>
                        <dd className="text-xl font-bold text-slate-900">{contado}</dd>
                      </div>
                    ) : (
                      <p className="font-semibold text-marca-600">Consultanos el precio</p>
                    )}
                    {tarjeta && (
                      <div className="mt-1 flex items-baseline justify-between">
                        <dt className="text-slate-500">Con tarjeta</dt>
                        <dd className="font-semibold text-slate-700">{tarjeta}</dd>
                      </div>
                    )}
                  </dl>

                  {servicio.cantidadClases > 1 && (
                    <p className="mt-3 text-xs text-slate-500">
                      {servicio.cantidadClases} clases de {servicio.duracionMin} minutos
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
