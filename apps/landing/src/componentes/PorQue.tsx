import { Route, ShieldCheck, UserCheck, Gauge } from 'lucide-react';
import { porQue } from '../contenido';
import { useSeccion } from '../contexto/ContenidoContexto';
import { items as resolverItems, texto } from '../lib/contenidoRemoto';
import { Seccion, TituloSeccion } from './ui/Seccion';

const ICONOS = {
  volante: Gauge,
  escudo: ShieldCheck,
  instructor: UserCheck,
  carretera: Route,
} as const;

const ORDEN_ICONOS = ['volante', 'escudo', 'instructor', 'carretera'] as const;

export function PorQue() {
  const config = useSeccion('porQue');
  if (!config.visible) return null;

  // Las tarjetas configuradas desde el panel no traen ícono: se reparten los
  // mismos íconos del diseño en orden, que es lo que mantiene la sección
  // reconocible sin pedirle a nadie que elija un ícono.
  const tarjetas = resolverItems(config.items, [...porQue.tarjetas], (item, indice) => ({
    icono: ORDEN_ICONOS[indice % ORDEN_ICONOS.length],
    titulo: item.titulo,
    detalle: item.detalle ?? '',
  }));

  return (
    <Seccion id="por-que">
      <TituloSeccion
        sobretitulo={texto(config.etiqueta, 'Por qué Gimenoos')}
        titulo={texto(config.titulo, porQue.titulo)}
        bajada={texto(config.bajada, porQue.texto)}
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((tarjeta, indice) => {
          const Icono = ICONOS[tarjeta.icono];
          return (
            <article
              key={tarjeta.titulo}
              className="aparece group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-marca-500 hover:shadow-xl hover:shadow-marca-500/10"
              style={{ transitionDelay: `${indice * 80}ms` }}
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-marca-50 text-marca-500 transition group-hover:bg-marca-500 group-hover:text-white">
                <Icono size={24} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-carbon-950">{tarjeta.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{tarjeta.detalle}</p>
            </article>
          );
        })}
      </div>
    </Seccion>
  );
}
