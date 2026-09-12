import { academia, hero } from '../contenido';

export function Hero() {
  return (
    <section id="inicio" className="bg-gradient-to-b from-marca-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-marca-600">
          {academia.ciudad}, {academia.departamento}
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
          {hero.titulo}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">{hero.subtitulo}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={hero.ctaPrincipal.destino}
            className="rounded-lg bg-marca-600 px-6 py-3 font-semibold text-white transition hover:bg-marca-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-700 focus-visible:ring-offset-2"
          >
            {hero.ctaPrincipal.texto}
          </a>
          <a
            href={hero.ctaSecundario.destino}
            className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:border-marca-600 hover:text-marca-600"
          >
            {hero.ctaSecundario.texto}
          </a>
        </div>
      </div>
    </section>
  );
}
