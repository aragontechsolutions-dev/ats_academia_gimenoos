import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';

import { obtenerGaleriaPorAnio, type AnioDeEgresados, type GraduadoPublico } from '../lib/api';
import { Seccion, TituloSeccion } from '../componentes/ui/Seccion';
import { Carrusel } from '../componentes/ui/Carrusel';
import { useNegocio } from '../contexto/ContenidoContexto';

const CATEGORIA: Record<string, string> = {
  A: 'Automóvil',
  G1: 'Ciclomotor',
  G2: 'Motocicleta',
  G3: 'Motocicleta',
};

/**
 * Una foto de la galería.
 *
 * El ancho es fijo (`w-64`) y no proporcional: dentro de un carrusel las
 * tarjetas tienen que medir lo mismo estén donde estén, y `shrink-0` es lo que
 * impide que se apretujen para entrar en el ancho disponible, que es justo lo
 * contrario de lo que se quiere acá.
 */
function Tarjeta({ graduado }: { graduado: GraduadoPublico }) {
  return (
    <li className="w-64 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-carbon-950/5">
      {graduado.fotoUrl ? (
        <img
          src={graduado.fotoUrl}
          alt={`${graduado.nombre} ${graduado.apellido} con su diploma`}
          loading="lazy"
          className="h-60 w-full object-cover"
        />
      ) : (
        /* Sin foto la tarjeta igual dice algo: nombre, categoría y año ya son
           prueba social. Un hueco gris no lo sería. */
        <div aria-hidden="true" className="flex h-60 items-center justify-center bg-carbon-950">
          <GraduationCap size={40} className="text-marca-500" />
        </div>
      )}
      <div className="p-5">
        <p className="text-lg font-bold text-carbon-950">
          {graduado.nombre} {graduado.apellido}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {CATEGORIA[graduado.categoria] ?? graduado.categoria}
        </p>
      </div>
    </li>
  );
}

/** Un año con su carrusel. */
function AnioConCarrusel({ grupo }: { grupo: AnioDeEgresados }) {
  const faltan = grupo.total - grupo.graduados.length;

  return (
    <section className="aparece mt-14 first:mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-3xl font-black tracking-tight text-carbon-950">{grupo.anio}</h2>
        <p className="text-sm text-slate-600">
          {grupo.total === 1 ? '1 egresado' : `${grupo.total} egresados`}
          {/* Se dice cuántos no se muestran en vez de recortar en silencio: un
              año que dice «120 egresados» y enseña 24 sin aclararlo parece roto. */}
          {faltan > 0 && ` · se muestran los ${grupo.graduados.length} más recientes`}
        </p>
      </div>

      <div className="mt-5">
        <Carrusel etiqueta={String(grupo.anio)}>
          {grupo.graduados.map((graduado) => (
            <Tarjeta key={graduado.id} graduado={graduado} />
          ))}
        </Carrusel>
      </div>
    </section>
  );
}

/**
 * La galería pública de egresados, un carrusel por año.
 *
 * Antes era un filtro por año más paginación: había que elegir un año, después
 * un tamaño de página, y recién ahí se veía algo. Ahora la página se baja y
 * están todos, agrupados por promoción, que es como los recuerda la academia.
 *
 * Los carruseles solo se mueven solos cuando las fotos no entran en el ancho de
 * la pantalla —ver `Carrusel`—, así que un año con tres egresados queda quieto.
 */
export function PaginaGraduadosPublica() {
  const [anios, setAnios] = useState<AnioDeEgresados[] | null>(null);
  const negocio = useNegocio();

  useEffect(() => {
    document.title = `Egresados | ${negocio.nombre}`;
  }, [negocio.nombre]);

  useEffect(() => {
    let vigente = true;
    void obtenerGaleriaPorAnio().then((resultado) => {
      if (vigente) setAnios(resultado);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const total = (anios ?? []).reduce((suma, grupo) => suma + grupo.total, 0);

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-carbon-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-acento-400"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <Seccion>
        {/* `nivel={1}`: esta es una página propia, no una sección de la
            portada. Sin esto el documento no tiene ningún h1. */}
        <TituloSeccion
          nivel={1}
          sobretitulo="Egresados"
          titulo="Los que ya manejan"
          bajada="Cada uno de ellos pasó por acá. Las fotos se publican con la autorización de cada persona."
        />

        {anios === null && <p className="mt-10 text-slate-500">Cargando…</p>}

        {anios !== null && anios.length === 0 && (
          <p className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
            Todavía no hay egresados publicados.
          </p>
        )}

        {anios !== null && anios.length > 0 && (
          <>
            <p className="aparece mt-8 text-slate-600">
              {total === 1 ? '1 egresado' : `${total} egresados`} en{' '}
              {anios.length === 1 ? 'un año' : `${anios.length} años`}.
            </p>
            {anios.map((grupo) => (
              <AnioConCarrusel key={grupo.anio} grupo={grupo} />
            ))}
          </>
        )}
      </Seccion>
    </main>
  );
}
