import { tramite } from '../contenido';

export function Tramite() {
  return (
    <section id="tramite" className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900">{tramite.titulo}</h2>
        <p className="mt-3 max-w-3xl text-slate-600">{tramite.introduccion}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold text-slate-900">Qué necesitás</h3>
            <ul className="mt-3 space-y-2">
              {tramite.requisitos.map((requisito) => (
                <li key={requisito} className="flex gap-2 text-slate-700">
                  <span aria-hidden="true" className="text-marca-600">
                    •
                  </span>
                  {requisito}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">Categorías que preparamos</h3>
            <dl className="mt-3 space-y-3">
              {tramite.categorias.map((categoria) => (
                <div key={categoria.codigo} className="flex gap-3">
                  <dt className="flex h-7 w-10 shrink-0 items-center justify-center rounded bg-marca-100 text-sm font-bold text-marca-700">
                    {categoria.codigo}
                  </dt>
                  <dd className="text-slate-700">{categoria.descripcion}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {tramite.aclaracion}{' '}
          <a
            href={tramite.enlaceOficial}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
          >
            Consultá la información oficial
          </a>
          .
        </p>
      </div>
    </section>
  );
}
