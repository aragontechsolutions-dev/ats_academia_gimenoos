import { categorias } from '../contenido';

export function Categorias() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-3xl font-bold text-slate-900">Moto y auto</h2>
      <p className="mt-2 max-w-2xl text-slate-600">
        Dos formas de empezar, con instructores y vehículos preparados para cada una.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {categorias.map((categoria) => (
          <article
            key={categoria.id}
            className="rounded-xl border border-slate-200 p-6 transition hover:border-marca-600"
          >
            <h3 className="text-xl font-semibold text-slate-900">{categoria.titulo}</h3>
            <p className="mt-2 text-slate-600">{categoria.descripcion}</p>
            <ul className="mt-4 space-y-2">
              {categoria.puntos.map((punto) => (
                <li key={punto} className="flex gap-2 text-sm text-slate-700">
                  <span aria-hidden="true" className="text-marca-600">
                    ✓
                  </span>
                  {punto}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
