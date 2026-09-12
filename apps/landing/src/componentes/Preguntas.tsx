import { preguntas } from '../contenido';

export function Preguntas() {
  return (
    <section id="preguntas" className="mx-auto max-w-3xl px-4 py-16">
      <h2 className="text-3xl font-bold text-slate-900">Preguntas frecuentes</h2>
      <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
        {preguntas.map((item) => (
          // <details> da acordeon accesible y funcional sin JavaScript.
          <details key={item.pregunta} className="group py-4">
            <summary className="flex cursor-pointer items-center justify-between font-semibold text-slate-900">
              {item.pregunta}
              <span
                aria-hidden="true"
                className="ml-4 text-marca-600 transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-slate-600">{item.respuesta}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
