import { Bike, Car, Check } from 'lucide-react';
import { modalidades, opciones } from '../contenido';
import { Seccion, TituloSeccion } from './ui/Seccion';
import { useDestinoPrincipal, useSeccion } from '../contexto/ContenidoContexto';
import { items as resolverItems, texto } from '../lib/contenidoRemoto';

const ICONOS_MODALIDAD = { auto: Car, moto: Bike } as const;

export function Modalidades() {
  const principal = useDestinoPrincipal('modalidades');
  const config = useSeccion('modalidades');
  const configOpciones = useSeccion('opciones');
  if (!config.visible) return null;

  const listaOpciones = resolverItems(configOpciones.items, [...opciones], (item) => ({
    titulo: item.titulo,
    detalle: item.detalle ?? '',
  }));

  return (
    <Seccion id="clases" className="bg-slate-50">
      <TituloSeccion
        sobretitulo={texto(config.etiqueta, 'Clases')}
        titulo={texto(config.titulo, 'Moto y auto, desde cero o para mejorar')}
        bajada={texto(config.bajada, 'Elegí con qué querés empezar. Los vehículos los pone la academia.')}
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {modalidades.map((modalidad, indice) => {
          const Icono = ICONOS_MODALIDAD[modalidad.id];
          return (
            <article
              key={modalidad.id}
              className="aparece relative overflow-hidden rounded-2xl bg-carbon-950 p-8 text-white"
              style={{ transitionDelay: `${indice * 90}ms` }}
            >
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-marca-500/20 blur-2xl"
              />
              <div className="relative">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-marca-500 text-white">
                  <Icono size={28} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-2xl font-bold">{modalidad.titulo}</h3>
                <p className="mt-2 text-slate-300">{modalidad.descripcion}</p>
                <ul className="mt-6 space-y-2">
                  {modalidad.puntos.map((punto) => (
                    <li key={punto} className="flex items-start gap-2 text-sm text-slate-200">
                      <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-acento-400" />
                      {punto}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-14">
        <h3 className="aparece text-xl font-bold text-carbon-950">
          {texto(configOpciones.titulo, 'Encontrá la opción que necesitás')}
        </h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listaOpciones.map((opcion, indice) => (
            <article
              key={opcion.titulo}
              className="aparece flex flex-col rounded-xl border border-slate-200 bg-white p-5"
              style={{ transitionDelay: `${indice * 70}ms` }}
            >
              <span aria-hidden="true" className="h-1 w-10 rounded-full bg-acento-400" />
              <h4 className="mt-4 font-bold text-carbon-950">{opcion.titulo}</h4>
              <p className="mt-2 flex-1 text-sm text-slate-600">{opcion.detalle}</p>
              <a
                href={principal.href}
                {...(principal.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={principal.onClick}
                className="mt-4 text-sm font-bold text-marca-600 hover:text-marca-700"
              >
                Consultar →
              </a>
            </article>
          ))}
        </div>
      </div>
    </Seccion>
  );
}
