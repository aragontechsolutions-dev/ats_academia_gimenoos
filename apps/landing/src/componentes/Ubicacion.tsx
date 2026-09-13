import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { negocio } from '../contenido';
import { Seccion, TituloSeccion } from './ui/Seccion';
import { clasesBoton } from './ui/Boton';

/**
 * Dónde estamos y cómo contactarnos.
 *
 * Cada dato se muestra solo si está cargado en `contenido.ts`. No hay valores
 * de ejemplo: una dirección o un horario inventados hacen que alguien viaje al
 * lugar equivocado.
 */
export function Ubicacion() {
  return (
    <Seccion id="ubicacion">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <TituloSeccion
            sobretitulo="Dónde estamos"
            titulo={`En ${negocio.ciudad}, ${negocio.departamento}`}
            bajada="Damos clases en San Carlos y alrededores. Coordinamos el punto de encuentro con vos."
          />

          <dl className="aparece mt-8 space-y-5">
            {negocio.direccion && (
              <div className="flex gap-4">
                <dt className="shrink-0 text-marca-500">
                  <MapPin size={22} aria-hidden="true" />
                  <span className="sr-only">Dirección</span>
                </dt>
                <dd className="font-semibold text-carbon-950">{negocio.direccion}</dd>
              </div>
            )}

            {negocio.horarios && (
              <div className="flex gap-4">
                <dt className="shrink-0 text-marca-500">
                  <Clock size={22} aria-hidden="true" />
                  <span className="sr-only">Horarios</span>
                </dt>
                <dd className="font-semibold text-carbon-950">{negocio.horarios}</dd>
              </div>
            )}

            {negocio.telefono && (
              <div className="flex gap-4">
                <dt className="shrink-0 text-marca-500">
                  <Phone size={22} aria-hidden="true" />
                  <span className="sr-only">Teléfono</span>
                </dt>
                <dd>
                  <a
                    href={`tel:${negocio.telefono.replace(/\s/g, '')}`}
                    className="font-semibold text-carbon-950 hover:text-marca-600"
                  >
                    {negocio.telefono}
                  </a>
                </dd>
              </div>
            )}

            {negocio.email && (
              <div className="flex gap-4">
                <dt className="shrink-0 text-marca-500">
                  <Mail size={22} aria-hidden="true" />
                  <span className="sr-only">Correo</span>
                </dt>
                <dd>
                  <a
                    href={`mailto:${negocio.email}`}
                    className="font-semibold text-carbon-950 hover:text-marca-600"
                  >
                    {negocio.email}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {negocio.mapaUrl && (
            <a
              href={negocio.mapaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${clasesBoton('contornoOscuro')} mt-8`}
            >
              <MapPin size={18} aria-hidden="true" />
              Cómo llegar
            </a>
          )}
        </div>

        {/* Mapa ilustrativo de la zona de cobertura: no marca una dirección que
            todavía no está confirmada, solo ubica la ciudad. */}
        <div className="aparece relative overflow-hidden rounded-2xl bg-carbon-950 p-10 text-white">
          <div
            aria-hidden="true"
            className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-marca-500/25 blur-3xl"
          />
          <svg
            viewBox="0 0 400 260"
            className="relative w-full"
            role="img"
            aria-label={`Ilustración de la zona de cobertura: ${negocio.ciudad} y alrededores`}
          >
            <g stroke="currentColor" strokeWidth="1" className="text-white/10" fill="none">
              <path d="M0 60h400M0 130h400M0 200h400M90 0v260M200 0v260M310 0v260" />
            </g>
            <path
              d="M20 220 C 120 200, 130 120, 200 110 S 300 70, 380 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className="text-marca-500"
            />
            <path
              d="M20 220 C 120 200, 130 120, 200 110 S 300 70, 380 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="10 12"
              strokeLinecap="round"
              className="text-acento-400"
            />
            <circle cx="200" cy="110" r="10" className="fill-acento-400" />
            <circle cx="200" cy="110" r="20" className="fill-acento-400/20" />
          </svg>
          <p className="relative mt-6 text-lg font-bold">
            {negocio.ciudad}, {negocio.departamento}
          </p>
          <p className="relative mt-1 text-sm text-slate-400">
            Clases en la ciudad y en la zona.
          </p>
        </div>
      </div>
    </Seccion>
  );
}
