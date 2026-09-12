import { instructores } from '../contenido';

/**
 * La seccion no se renderiza mientras no haya instructores reales cargados.
 * Publicar personas o credenciales inventadas seria enganioso.
 */
export function Instructores() {
  if (instructores.length === 0) return null;

  return (
    <section id="instructores" className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-3xl font-bold text-slate-900">Quiénes te enseñan</h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {instructores.map((instructor) => (
          <article key={instructor.nombre} className="rounded-xl border border-slate-200 p-6">
            {instructor.foto && (
              <img
                src={instructor.foto}
                alt={`Foto de ${instructor.nombre}`}
                className="h-20 w-20 rounded-full object-cover"
                loading="lazy"
                width={80}
                height={80}
              />
            )}
            <h3 className="mt-4 font-semibold text-slate-900">{instructor.nombre}</h3>
            <p className="text-sm text-marca-600">{instructor.rol}</p>
            <p className="mt-2 text-sm text-slate-600">{instructor.descripcion}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
