import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

const CLASES_CONTROL =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-marca-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';

/**
 * Etiqueta + control + texto de ayuda.
 *
 * El texto de ayuda va FUERA del `<label>` y se enlaza con `aria-describedby`.
 * Estando adentro, el nombre accesible del campo pasa a ser "WhatsApp Solo
 * números, con código de país y sin espacios…": un lector de pantalla lee la
 * ayuda entera cada vez que el foco entra al campo, y quien navega por voz no
 * puede nombrarlo. Afuera, el nombre es "WhatsApp" y la ayuda se anuncia como
 * descripción, que es para lo que existe.
 */
export function Campo({
  etiqueta,
  children,
  ayuda,
  requerido,
}: {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
  requerido?: boolean;
}) {
  const id = useId();
  const idControl = `${id}-control`;
  const idAyuda = `${id}-ayuda`;

  // Se le pasan `id` y `aria-describedby` al control sin que cada formulario
  // tenga que inventarlos. Si el hijo no es un elemento (poco probable), se
  // devuelve tal cual en vez de romper.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: idControl,
        ...(ayuda ? { 'aria-describedby': idAyuda } : {}),
      })
    : children;

  return (
    <div className="block">
      <label htmlFor={idControl} className="text-sm font-medium text-slate-700">
        {etiqueta}
        {requerido && <span className="text-red-600"> *</span>}
      </label>
      {control}
      {ayuda && (
        <span id={idAyuda} className="mt-1 block text-xs text-slate-500">
          {ayuda}
        </span>
      )}
    </div>
  );
}

export const clasesControl = CLASES_CONTROL;
