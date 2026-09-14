/**
 * El mismo logotipo del sitio público y del panel: la academia es una sola.
 *
 * `tono` sirve para las dos superficies donde aparece: la barra oscura de la app
 * y la pantalla de ingreso.
 */
export function Logotipo({ etiqueta, className = '' }: { etiqueta?: string; className?: string }) {
  return (
    <span className={`flex items-baseline gap-1 font-extrabold tracking-tight ${className}`}>
      GIMENOOS
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-marca-500" />
      {etiqueta && (
        <span className="ml-2 text-xs font-medium uppercase tracking-widest text-slate-400">
          {etiqueta}
        </span>
      )}
    </span>
  );
}
