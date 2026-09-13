import { Quote } from 'lucide-react';
import { testimonios } from '../contenido';
import { Seccion, TituloSeccion } from './ui/Seccion';
import { useSeccion } from '../contexto/ContenidoContexto';
import { texto } from '../lib/contenidoRemoto';

/**
 * Testimonios.
 *
 * Solo testimonios reales con autorización del alumno. Inventar una reseña es
 * publicidad engañosa y además expone a la academia; mientras no haya ninguna
 * cargada, la sección simplemente no está.
 */
export function Testimonios() {
  const config = useSeccion('testimonios');
  if (!config.visible || testimonios.length === 0) return null;

  return (
    <Seccion id="testimonios" oscura>
      <TituloSeccion
        sobretitulo={texto(config.etiqueta, 'Alumnos')}
        titulo={texto(config.titulo, 'Lo que cuentan quienes ya manejan')}
        bajada={config.bajada ?? undefined}
        claro
      />

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {testimonios.map((testimonio, indice) => (
          <figure
            key={testimonio.nombre}
            className="aparece rounded-2xl bg-carbon-900 p-7"
            style={{ transitionDelay: `${indice * 80}ms` }}
          >
            <Quote size={28} aria-hidden="true" className="text-marca-500" />
            <blockquote className="mt-4 text-slate-200">{testimonio.texto}</blockquote>
            <figcaption className="mt-5 border-t border-white/10 pt-4 text-sm font-bold text-white">
              {testimonio.nombre}
            </figcaption>
          </figure>
        ))}
      </div>
    </Seccion>
  );
}
