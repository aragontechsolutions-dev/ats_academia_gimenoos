import { testimonios } from '../contenido';

/**
 * Solo se muestran testimonios reales con autorizacion del alumno.
 * Mientras el arreglo este vacio, la seccion no existe en la pagina.
 */
export function Testimonios() {
  if (testimonios.length === 0) return null;

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900">Lo que dicen nuestros alumnos</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {testimonios.map((testimonio) => (
            <figure key={testimonio.nombre} className="rounded-xl bg-white p-6 shadow-sm">
              <blockquote className="text-slate-700">“{testimonio.texto}”</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-slate-900">
                {testimonio.nombre}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
