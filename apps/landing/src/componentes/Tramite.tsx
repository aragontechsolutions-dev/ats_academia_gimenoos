import { ExternalLink, FileText, Info } from 'lucide-react';
import { tramite } from '../contenido';
import { Seccion, TituloSeccion } from './ui/Seccion';

export function Tramite() {
  return (
    <Seccion id="tramite" className="bg-slate-50">
      <TituloSeccion sobretitulo="Libreta" titulo={tramite.titulo} bajada={tramite.introduccion} />

      <div className="mt-12 grid gap-6 lg:grid-cols-5">
        <div className="aparece rounded-2xl border border-slate-200 bg-white p-7 lg:col-span-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-carbon-950">
            <FileText size={20} aria-hidden="true" className="text-marca-500" />
            Qué necesitás
          </h3>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {tramite.requisitos.map((requisito) => (
              <li key={requisito} className="flex items-start gap-2 text-sm text-slate-700">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-marca-500"
                />
                {requisito}
              </li>
            ))}
          </ul>
        </div>

        <div className="aparece rounded-2xl bg-carbon-950 p-7 text-white lg:col-span-2">
          <h3 className="text-lg font-bold">Categorías que preparamos</h3>
          <dl className="mt-5 space-y-4">
            {tramite.categorias.map((categoria) => (
              <div key={categoria.codigo} className="flex items-center gap-4">
                <dt className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-marca-500 text-sm font-extrabold text-white">
                  {categoria.codigo}
                </dt>
                <dd className="text-sm text-slate-300">{categoria.descripcion}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <p className="aparece mt-6 flex flex-col gap-2 rounded-xl border-l-4 border-acento-400 bg-white p-5 text-sm text-slate-700 sm:flex-row sm:items-center sm:gap-3">
        <Info size={20} aria-hidden="true" className="shrink-0 text-acento-500" />
        <span>
          {tramite.aclaracion}{' '}
          <a
            href={tramite.enlaceOficial}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-marca-600 underline hover:text-marca-700"
          >
            Información oficial
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </span>
      </p>
    </Seccion>
  );
}
