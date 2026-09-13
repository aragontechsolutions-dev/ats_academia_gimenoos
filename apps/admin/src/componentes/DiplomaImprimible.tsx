import { useEffect } from 'react';
import { Diploma } from './Diploma';
import type { Graduado } from '../lib/tipos';

/**
 * Envoltura para imprimir: oculta todo el panel y deja solo el diploma.
 *
 * Se usa una hoja de estilos de impresión y no una ventana nueva porque abrir
 * una ventana emergente choca con los bloqueadores del navegador, y porque así
 * se ve en pantalla exactamente lo que va a salir en el papel.
 */
export function DiplomaImprimible({
  graduado,
  sitioUrl,
  onCerrar,
}: {
  graduado: Graduado;
  sitioUrl: string;
  onCerrar: () => void;
}) {
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-100 print:static print:bg-white">
      <div className="no-imprimir sticky top-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">
          Así se va a imprimir. Conviene usar orientación vertical y márgenes por defecto.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-marca-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-marca-600"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
          >
            Cerrar
          </button>
        </div>
      </div>

      <div className="p-6 print:p-0">
        <Diploma graduado={graduado} sitioUrl={sitioUrl} />
      </div>
    </div>
  );
}
