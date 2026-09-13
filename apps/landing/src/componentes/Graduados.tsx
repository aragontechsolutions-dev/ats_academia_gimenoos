import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap } from 'lucide-react';

import { obtenerGraduados, type GraduadoPublico } from '../lib/api';
import { Seccion, TituloSeccion } from './ui/Seccion';
import { useSeccion } from '../contexto/ContenidoContexto';
import { texto } from '../lib/contenidoRemoto';

/** Cuántos egresados se muestran en la portada antes del enlace al histórico. */
const EN_PORTADA = 6;

/**
 * Los egresados más recientes, en la portada.
 *
 * Es la prueba social más honesta que tiene el sitio: personas reales de San
 * Carlos que aprendieron acá. Solo aparecen quienes firmaron la autorización;
 * eso lo garantiza la base de datos, no esta pantalla.
 *
 * Se muestran unos pocos y el resto va en su propia página: cien fotos en la
 * portada arruinarían el tiempo de carga, que es justo lo que hace que alguien
 * se vaya antes de leer nada.
 */
export function Graduados() {
  const [lista, setLista] = useState<GraduadoPublico[]>([]);
  const [total, setTotal] = useState(0);
  const config = useSeccion('graduados');

  useEffect(() => {
    let vigente = true;
    void obtenerGraduados({ porPagina: 10 }).then((pagina) => {
      if (!vigente) return;
      setLista(pagina.graduados.slice(0, EN_PORTADA));
      setTotal(pagina.total);
    });
    return () => {
      vigente = false;
    };
  }, []);

  // Sin egresados publicados la sección no existe: una galería vacía dice menos
  // que ninguna galería.
  if (!config.visible || lista.length === 0) return null;

  return (
    <Seccion id="graduados" className="bg-slate-50">
      <TituloSeccion
        sobretitulo={texto(config.etiqueta, 'Egresados')}
        titulo={texto(config.titulo, 'Ellos ya manejan')}
        bajada={texto(
          config.bajada,
          'Alumnos de la academia con su diploma. Las fotos se publican con la autorización de cada persona.',
        )}
      />

      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((graduado, indice) => (
          <li
            key={graduado.id}
            className="aparece overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-carbon-950/5"
            style={{ transitionDelay: `${indice * 60}ms` }}
          >
            {graduado.fotoUrl ? (
              <img
                src={graduado.fotoUrl}
                alt={`${graduado.nombre} ${graduado.apellido} con su diploma`}
                loading="lazy"
                className="h-56 w-full object-cover"
              />
            ) : (
              <div aria-hidden="true" className="flex h-28 items-center justify-center bg-carbon-950">
                <GraduationCap size={36} className="text-marca-500" />
              </div>
            )}
            <div className="p-5">
              <p className="font-bold text-carbon-950">
                {graduado.nombre} {graduado.apellido}
              </p>
              <p className="mt-1 text-sm text-slate-600">{graduado.anio}</p>
            </div>
          </li>
        ))}
      </ul>

      {total > EN_PORTADA && (
        <div className="aparece mt-10">
          <Link
            to="/graduados"
            className="inline-flex items-center gap-2 text-base font-bold text-marca-600 transition hover:text-marca-700"
          >
            {texto(config.accion, `Ver los ${total} egresados`)}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      )}
    </Seccion>
  );
}
