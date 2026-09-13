import { instructores } from '../contenido';
import { Seccion, TituloSeccion } from './ui/Seccion';

/**
 * Instructores.
 *
 * Publicar el nombre y la foto de una persona es tratar un dato personal
 * (Ley 18.331): la sección solo aparece cuando hay instructores cargados, lo
 * que en la práctica significa que alguien dio esa autorización.
 */
export function Instructores() {
  if (instructores.length === 0) return null;

  return (
    <Seccion id="instructores">
      <TituloSeccion
        sobretitulo="Equipo"
        titulo="Quién te va a enseñar"
        bajada="Vas a manejar acompañado por alguien que enseña todos los días."
      />

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {instructores.map((instructor, indice) => (
          <article
            key={instructor.nombre}
            className="aparece overflow-hidden rounded-2xl border border-slate-200 bg-white"
            style={{ transitionDelay: `${indice * 80}ms` }}
          >
            {instructor.foto && (
              <img
                src={instructor.foto}
                alt={`Instructor: ${instructor.nombre}`}
                loading="lazy"
                className="h-56 w-full object-cover"
              />
            )}
            <div className="p-6">
              <h3 className="text-lg font-bold text-carbon-950">{instructor.nombre}</h3>
              <p className="text-sm font-semibold text-marca-600">{instructor.rol}</p>
              <p className="mt-3 text-sm text-slate-600">{instructor.descripcion}</p>
            </div>
          </article>
        ))}
      </div>
    </Seccion>
  );
}
