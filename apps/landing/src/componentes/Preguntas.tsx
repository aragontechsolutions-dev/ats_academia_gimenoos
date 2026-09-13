import { Plus } from 'lucide-react';
import { preguntas } from '../contenido';
import { useSeccion } from '../contexto/ContenidoContexto';
import { items as resolverItems, texto } from '../lib/contenidoRemoto';
import { Seccion, TituloSeccion } from './ui/Seccion';

export function Preguntas() {
  const config = useSeccion('preguntas');
  if (!config.visible) return null;

  // En esta sección el título del ítem es la pregunta y el detalle la respuesta.
  const lista = resolverItems(
    config.items,
    preguntas.map((p) => ({ pregunta: p.pregunta, respuesta: p.respuesta })),
    (item) => ({ pregunta: item.titulo, respuesta: item.detalle ?? '' }),
  );

  return (
    <Seccion id="preguntas" className="bg-slate-50">
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TituloSeccion
            sobretitulo={texto(config.etiqueta, 'Preguntas')}
            titulo={texto(config.titulo, 'Lo que más nos consultan')}
            bajada={texto(config.bajada, '¿Te quedó alguna duda? Escribinos y te la respondemos.')}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {lista.map((item) => (
              /* <details> da un acordeón accesible y funcional sin JavaScript. */
              <details key={item.pregunta} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-bold text-carbon-950 transition hover:text-marca-600">
                  {item.pregunta}
                  <Plus
                    size={20}
                    aria-hidden="true"
                    className="shrink-0 text-marca-500 transition group-open:rotate-45"
                  />
                </summary>
                <p className="px-5 pb-5 text-slate-600">{item.respuesta}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </Seccion>
  );
}
