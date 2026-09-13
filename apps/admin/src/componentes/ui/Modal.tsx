import { useEffect, type ReactNode } from 'react';

/**
 * Diálogo modal.
 *
 * Cierra con Escape y con clic en el fondo: en un panel que se usa a diario,
 * quedar atrapado en un formulario es la diferencia entre una herramienta ágil
 * y una molesta.
 */
export function Modal({
  titulo,
  children,
  onCerrar,
  ancho = 'max-w-lg',
}: {
  titulo: string;
  children: ReactNode;
  onCerrar: () => void;
  ancho?: string;
}) {
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
      // Solo cierra si el clic fue en el fondo mismo. Depender de que el
      // contenido detenga la propagación no alcanza: cuando el elemento
      // clickeado desaparece del DOM dentro de su propio manejador —al elegir
      // un alumno de la lista de resultados, por ejemplo— React ya no encuentra
      // el camino hasta ese `stopPropagation` y el diálogo se cerraba solo.
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`w-full ${ancho} rounded-xl border border-slate-200 bg-white shadow-xl`}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <span className="sr-only">Cerrar</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
