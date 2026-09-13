import { pasos } from '../contenido';
import { useSeccion } from '../contexto/ContenidoContexto';
import { items as resolverItems, texto } from '../lib/contenidoRemoto';
import { Seccion, TituloSeccion } from './ui/Seccion';

/**
 * El proceso dibujado como una carretera: la línea punteada que une los pasos
 * refuerza la idea de recorrido sin necesidad de explicarla.
 */
export function Proceso() {
  const config = useSeccion('proceso');
  if (!config.visible) return null;

  // La numeración la pone el diseño, no quien escribe: así los pasos quedan
  // siempre bien numerados aunque se agregue o se quite uno desde el panel.
  const lista = resolverItems(config.items, [...pasos], (item, indice) => ({
    numero: String(indice + 1).padStart(2, '0'),
    titulo: item.titulo,
    detalle: item.detalle ?? '',
  }));

  return (
    <Seccion id="proceso" oscura>
      <TituloSeccion
        sobretitulo={texto(config.etiqueta, 'Cómo funciona')}
        titulo={texto(config.titulo, 'Tu camino hasta la libreta')}
        bajada={texto(config.bajada, 'Cuatro pasos, sin vueltas.')}
        claro
      />

      <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {/* La "ruta": línea punteada horizontal detrás de los números. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-7 hidden border-t-2 border-dashed border-white/15 lg:block"
        />

        {lista.map((paso, indice) => (
          <li
            key={paso.numero}
            className="aparece relative"
            style={{ transitionDelay: `${indice * 100}ms` }}
          >
            <span className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full bg-marca-500 text-lg font-extrabold text-white ring-8 ring-carbon-950">
              {paso.numero}
            </span>
            <h3 className="mt-5 text-lg font-bold text-white">{paso.titulo}</h3>
            <p className="mt-2 text-sm text-slate-400">{paso.detalle}</p>
          </li>
        ))}
      </ol>
    </Seccion>
  );
}
