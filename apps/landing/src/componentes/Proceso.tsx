import { pasos } from '../contenido';

export function Proceso() {
  return (
    <section id="proceso" className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-3xl font-bold text-slate-900">Cómo funciona</h2>
      <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {pasos.map((paso) => (
          <li key={paso.numero} className="rounded-xl border border-slate-200 p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-marca-600 font-bold text-white">
              {paso.numero}
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">{paso.titulo}</h3>
            <p className="mt-2 text-sm text-slate-600">{paso.detalle}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
