/** Tamaños que acepta la API. Cualquier otro lo ignora y usa el de por defecto. */
export const TAMANOS_PAGINA = [10, 20, 50, 100] as const;

/** Una página de resultados, igual para todos los listados de la API. */
export interface Pagina<T> {
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  datos: T[];
}

export const PAGINA_VACIA = { total: 0, pagina: 1, porPagina: 10, paginas: 1, datos: [] };

/**
 * Controles de paginación.
 *
 * No se muestra si todo entra en una página: con siete alumnos cargados, una
 * barra que dice "página 1 de 1" solo ocupa lugar. El selector de cantidad sí
 * aparece apenas hay más de una página.
 */
export function Paginacion({
  pagina,
  onCambio,
  etiqueta = 'resultados',
}: {
  pagina: { total: number; pagina: number; porPagina: number; paginas: number };
  onCambio: (cambios: { pagina?: number; porPagina?: number }) => void;
  /** Cómo se llaman los elementos: "alumnos", "vehículos"… */
  etiqueta?: string;
}) {
  if (pagina.total === 0) return null;

  const desde = (pagina.pagina - 1) * pagina.porPagina + 1;
  const hasta = Math.min(pagina.pagina * pagina.porPagina, pagina.total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm">
      <p className="text-slate-600">
        {pagina.total === 1 ? `1 ${etiqueta.replace(/s$/, '')}` : `${desde}–${hasta} de ${pagina.total} ${etiqueta}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-slate-600">
          Mostrar
          <select
            value={pagina.porPagina}
            onChange={(evento) =>
              // Al cambiar la cantidad se vuelve a la primera página: quedarse
              // en la página 7 con 100 por página suele caer fuera del total.
              onCambio({ porPagina: Number(evento.target.value), pagina: 1 })
            }
            className="rounded-lg border border-slate-300 px-2 py-1"
          >
            {TAMANOS_PAGINA.map((tamano) => (
              <option key={tamano} value={tamano}>
                {tamano}
              </option>
            ))}
          </select>
        </label>

        {pagina.paginas > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagina.pagina <= 1}
              onClick={() => onCambio({ pagina: pagina.pagina - 1 })}
              className="rounded-lg border border-slate-300 px-3 py-1 text-slate-700 transition hover:border-marca-500 disabled:opacity-40 disabled:hover:border-slate-300"
            >
              Anterior
            </button>
            <span className="text-slate-600">
              {pagina.pagina} de {pagina.paginas}
            </span>
            <button
              type="button"
              disabled={pagina.pagina >= pagina.paginas}
              onClick={() => onCambio({ pagina: pagina.pagina + 1 })}
              className="rounded-lg border border-slate-300 px-3 py-1 text-slate-700 transition hover:border-marca-500 disabled:opacity-40 disabled:hover:border-slate-300"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
