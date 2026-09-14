import { VISTAS, type Vista } from '../lib/agenda';

/**
 * Día · Semana · Mes.
 *
 * Es un control segmentado y no una barra de navegación abajo: las tres no son
 * secciones distintas de la app sino tres recortes de la misma agenda, y una
 * barra inferior prometería lugares a los que ir.
 *
 * `aria-pressed` y no `aria-current`: son botones que cambian el estado de esta
 * pantalla, no enlaces a otra.
 */
export function SelectorDeVista({
  vista,
  onCambiar,
}: {
  vista: Vista;
  onCambiar: (vista: Vista) => void;
}) {
  return (
    <div
      className="flex gap-1 rounded-xl bg-carbon-900 p-1"
      role="group"
      aria-label="Cómo ver la agenda"
    >
      {VISTAS.map(({ valor, etiqueta }) => {
        const activa = valor === vista;
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambiar(valor)}
            // El estado activo no se distingue solo por el color: el fondo
            // cambia y la letra pasa a negrita.
            className={`flex-1 rounded-lg py-2 text-sm transition ${
              activa
                ? 'bg-white font-semibold text-slate-900'
                : 'font-medium text-slate-300 hover:text-white'
            }`}
          >
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}
