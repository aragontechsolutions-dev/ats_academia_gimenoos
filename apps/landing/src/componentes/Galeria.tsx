import { galeria } from '../contenido';
import { Seccion, TituloSeccion } from './ui/Seccion';
import { useSeccion } from '../contexto/ContenidoContexto';
import { texto } from '../lib/contenidoRemoto';

/**
 * Galería de fotos reales de la academia.
 *
 * Se renderiza solo cuando hay fotos propias. Una galería de fotos de stock
 * muestra una academia que no es esta, y el visitante lo nota.
 */
export function Galeria() {
  const config = useSeccion('galeria');
  if (!config.visible || galeria.length === 0) return null;

  return (
    <Seccion id="galeria" className="bg-slate-50">
      <TituloSeccion
        sobretitulo={texto(config.etiqueta, 'Galería')}
        titulo={texto(config.titulo, 'La academia por dentro')}
        bajada={config.bajada ?? undefined}
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {galeria.map((foto, indice) => (
          <figure
            key={foto.src}
            className="aparece overflow-hidden rounded-2xl bg-carbon-900"
            style={{ transitionDelay: `${indice * 60}ms` }}
          >
            <img
              src={foto.src}
              alt={foto.alt}
              loading="lazy"
              className="h-64 w-full object-cover transition duration-500 hover:scale-105"
            />
          </figure>
        ))}
      </div>
    </Seccion>
  );
}
