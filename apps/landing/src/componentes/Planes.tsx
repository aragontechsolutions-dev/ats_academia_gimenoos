import { useEffect, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { obtenerServicios, type ServicioPublico } from '../lib/api';
import { Seccion, TituloSeccion } from './ui/Seccion';
import { useDestinoPrincipal, useSeccion } from '../contexto/ContenidoContexto';
import { texto } from '../lib/contenidoRemoto';
import { clasesBoton } from './ui/Boton';

const formateador = new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency: 'UYU',
  maximumFractionDigits: 0,
});

/**
 * Un precio en 0 significa "todavía no cargado en el panel": se muestra
 * "Consultanos" en vez de publicar un precio incorrecto.
 */
function formatearPrecio(valor: string): string | null {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return formateador.format(numero);
}

/**
 * Cuál de los planes se destaca visualmente.
 *
 * El diseño pide una tarjeta destacada, pero no se puede rotular "el más
 * elegido" porque nadie midió eso: sería inventar un dato del negocio. Se
 * destaca el pack con más clases y se lo rotula por lo que efectivamente es
 * —"Más clases"—, que es verificable contra el propio catálogo.
 */
function indiceDestacado(servicios: ServicioPublico[]): number {
  let destacado = -1;
  let maximo = 1;
  servicios.forEach((servicio, indice) => {
    if (servicio.cantidadClases > maximo) {
      maximo = servicio.cantidadClases;
      destacado = indice;
    }
  });
  return destacado;
}

export function Planes() {
  const [servicios, setServicios] = useState<ServicioPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const principal = useDestinoPrincipal('planes');
  const config = useSeccion('planes');

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

  const destacado = indiceDestacado(servicios);

  return (
    <Seccion id="planes">
      <TituloSeccion
        sobretitulo={texto(config.etiqueta, 'Planes')}
        titulo={texto(config.titulo, 'Clases y precios')}
        bajada={texto(
          config.bajada,
          'Los precios los actualiza la academia desde su panel, así que lo que ves acá es lo que vale hoy. El valor de contado o transferencia puede diferir del de tarjeta.',
        )}
      />

      {cargando && <p className="mt-10 text-slate-500">Cargando precios…</p>}

      {!cargando && servicios.length === 0 && (
        <p className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
          En este momento no podemos mostrar el listado de precios.{' '}
          <a
            href={principal.href}
            {...(principal.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            onClick={principal.onClick}
            className="font-bold text-marca-600 underline"
          >
            Consultanos y te lo pasamos.
          </a>
        </p>
      )}

      {servicios.length > 0 && (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {servicios.map((servicio, indice) => {
            const contado = formatearPrecio(servicio.precioContado);
            const tarjeta = formatearPrecio(servicio.precioTarjeta);
            const esDestacado = indice === destacado;

            return (
              <article
                key={servicio.id}
                className={`aparece relative flex flex-col rounded-2xl p-7 transition hover:-translate-y-1 ${
                  esDestacado
                    ? 'bg-carbon-950 text-white shadow-2xl shadow-carbon-950/20 ring-2 ring-marca-500'
                    : 'border border-slate-200 bg-white hover:border-marca-500 hover:shadow-xl hover:shadow-marca-500/10'
                }`}
                style={{ transitionDelay: `${indice * 70}ms` }}
              >
                {esDestacado && (
                  <span className="absolute -top-3 left-7 rounded-full bg-acento-400 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-carbon-950">
                    Más clases
                  </span>
                )}

                <h3
                  className={`text-lg font-bold ${esDestacado ? 'text-white' : 'text-carbon-950'}`}
                >
                  {servicio.nombre}
                </h3>
                {servicio.descripcion && (
                  <p
                    className={`mt-2 flex-1 text-sm leading-relaxed ${
                      esDestacado ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    {servicio.descripcion}
                  </p>
                )}

                <div
                  className={`mt-6 border-t pt-5 ${
                    esDestacado ? 'border-white/15' : 'border-slate-100'
                  }`}
                >
                  {contado ? (
                    <>
                      <p
                        className={`text-3xl font-extrabold ${
                          esDestacado ? 'text-white' : 'text-carbon-950'
                        }`}
                      >
                        {contado}
                      </p>
                      <p className={`text-xs ${esDestacado ? 'text-slate-400' : 'text-slate-500'}`}>
                        contado o transferencia
                      </p>
                      {tarjeta && (
                        <p
                          className={`mt-2 text-sm ${
                            esDestacado ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          Con tarjeta: <span className="font-bold">{tarjeta}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p
                      className={`text-xl font-bold ${
                        esDestacado ? 'text-acento-400' : 'text-marca-500'
                      }`}
                    >
                      Consultanos el precio
                    </p>
                  )}
                </div>

                <ul
                  className={`mt-5 space-y-2 text-sm ${
                    esDestacado ? 'text-slate-200' : 'text-slate-600'
                  }`}
                >
                  {/* La gestoría no es una clase: viene con duración 0 y mostrar
                      "0 minutos por clase" es peor que no mostrar nada. */}
                  {servicio.duracionMin > 0 && (
                    <li className="flex items-center gap-2">
                      <Clock size={16} aria-hidden="true" className="shrink-0 text-marca-500" />
                      {servicio.duracionMin} minutos por clase
                    </li>
                  )}
                  {servicio.cantidadClases > 1 && (
                    <li className="flex items-center gap-2">
                      <Check size={16} aria-hidden="true" className="shrink-0 text-marca-500" />
                      {servicio.cantidadClases} clases
                    </li>
                  )}
                  {servicio.tipoVehiculo && (
                    <li className="flex items-center gap-2">
                      <Check size={16} aria-hidden="true" className="shrink-0 text-marca-500" />
                      {servicio.tipoVehiculo === 'AUTO' ? 'Auto' : 'Moto'}
                    </li>
                  )}
                </ul>

                <a
                  href={principal.href}
                  {...(principal.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  onClick={principal.onClick}
                  className={`${clasesBoton(esDestacado ? 'acento' : 'contornoOscuro')} mt-6 w-full`}
                >
                  Consultar
                </a>
              </article>
            );
          })}
        </div>
      )}
    </Seccion>
  );
}
