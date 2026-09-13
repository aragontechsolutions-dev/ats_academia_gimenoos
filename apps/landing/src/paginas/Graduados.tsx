import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';

import {
  obtenerAniosGraduados,
  obtenerGraduados,
  TAMANOS_PAGINA,
  type PaginaGraduados,
} from '../lib/api';
import { Seccion, TituloSeccion } from '../componentes/ui/Seccion';
import { useNegocio } from '../contexto/ContenidoContexto';

const CATEGORIA: Record<string, string> = {
  A: 'Automóvil',
  G1: 'Ciclomotor',
  G2: 'Motocicleta',
  G3: 'Motocicleta',
};

const VACIA: PaginaGraduados = { total: 0, pagina: 1, porPagina: 10, paginas: 1, graduados: [] };

/** Lee un número de la URL, cayendo al valor por defecto si no es válido. */
function numero(valor: string | null, porDefecto: number): number {
  const convertido = Number(valor);
  return Number.isInteger(convertido) && convertido > 0 ? convertido : porDefecto;
}

export function PaginaGraduadosPublica() {
  const [parametros, setParametros] = useSearchParams();
  const [datos, setDatos] = useState<PaginaGraduados>(VACIA);
  const [anios, setAnios] = useState<number[]>([]);
  const [cargando, setCargando] = useState(true);
  const negocio = useNegocio();

  const pagina = numero(parametros.get('pagina'), 1);
  const porPaginaCrudo = numero(parametros.get('porPagina'), 10);
  // Un tamaño inventado en la URL no se pasa a la API: se corrige acá.
  const porPagina = (TAMANOS_PAGINA as readonly number[]).includes(porPaginaCrudo)
    ? porPaginaCrudo
    : 10;
  const anio = parametros.get('anio') ? numero(parametros.get('anio'), 0) : undefined;

  useEffect(() => {
    document.title = `Egresados | ${negocio.nombre}`;
  }, [negocio.nombre]);

  useEffect(() => {
    void obtenerAniosGraduados().then(setAnios);
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    void obtenerGraduados({ pagina, porPagina, anio }).then((resultado) => {
      if (!vigente) return;
      setDatos(resultado);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, [pagina, porPagina, anio]);

  const cambiar = useCallback(
    (cambios: Record<string, string | undefined>) => {
      const siguientes = new URLSearchParams(parametros);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === undefined) siguientes.delete(clave);
        else siguientes.set(clave, valor);
      }
      setParametros(siguientes);
      window.scrollTo({ top: 0 });
    },
    [parametros, setParametros],
  );

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
        <TituloSeccion
          sobretitulo="Egresados"
          titulo="Los que ya manejan"
          bajada="Cada uno de ellos pasó por acá. Las fotos se publican con la autorización de cada persona."
        />

        <div className="aparece mt-10 flex flex-wrap items-end gap-6">
          <div>
            <label htmlFor="filtro-anio" className="block text-sm font-bold text-carbon-950">
              Año
            </label>
            <select
              id="filtro-anio"
              value={anio ?? ''}
              onChange={(evento) =>
                cambiar({ anio: evento.target.value || undefined, pagina: '1' })
              }
              className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-carbon-950 outline-none transition focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
            >
              <option value="">Todos los años</option>
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="por-pagina" className="block text-sm font-bold text-carbon-950">
              Mostrar
            </label>
            <select
              id="por-pagina"
              value={porPagina}
              onChange={(evento) => cambiar({ porPagina: evento.target.value, pagina: '1' })}
              className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-carbon-950 outline-none transition focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
            >
              {TAMANOS_PAGINA.map((tamano) => (
                <option key={tamano} value={tamano}>
                  {tamano} por página
                </option>
              ))}
            </select>
          </div>

          {!cargando && datos.total > 0 && (
            <p className="pb-2.5 text-sm text-slate-600">
              {datos.total === 1 ? '1 egresado' : `${datos.total} egresados`}
              {anio && ` en ${anio}`}
            </p>
          )}
        </div>

        {cargando && <p className="mt-10 text-slate-500">Cargando…</p>}

        {!cargando && datos.graduados.length === 0 && (
          <p className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
            Todavía no hay egresados publicados
            {anio && ` para ${anio}`}.
          </p>
        )}

        {datos.graduados.length > 0 && (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {datos.graduados.map((graduado) => (
              <li
                key={graduado.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-carbon-950/5"
              >
                {graduado.fotoRuta ? (
                  <img
                    src={graduado.fotoRuta}
                    alt={`${graduado.nombre} ${graduado.apellido} con su diploma`}
                    loading="lazy"
                    className="h-60 w-full object-cover"
                  />
                ) : (
                  /* Sin foto la tarjeta igual dice algo: nombre, categoría y año
                     ya son prueba social. Un hueco gris no lo sería. */
                  <div
                    aria-hidden="true"
                    className="flex h-32 items-center justify-center bg-carbon-950"
                  >
                    <GraduationCap size={40} className="text-marca-500" />
                  </div>
                )}
                <div className="p-5">
                  <p className="text-lg font-bold text-carbon-950">
                    {graduado.nombre} {graduado.apellido}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {CATEGORIA[graduado.categoria] ?? graduado.categoria} · {graduado.anio}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {datos.paginas > 1 && (
          <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label="Paginación">
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => cambiar({ pagina: String(pagina - 1) })}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-carbon-950 transition hover:border-marca-500 disabled:opacity-40 disabled:hover:border-slate-300"
            >
              Anterior
            </button>

            <span className="px-4 text-sm text-slate-600">
              Página {datos.pagina} de {datos.paginas}
            </span>

            <button
              type="button"
              disabled={pagina >= datos.paginas}
              onClick={() => cambiar({ pagina: String(pagina + 1) })}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-carbon-950 transition hover:border-marca-500 disabled:opacity-40 disabled:hover:border-slate-300"
            >
              Siguiente
            </button>
          </nav>
        )}
      </Seccion>
    </main>
  );
}
