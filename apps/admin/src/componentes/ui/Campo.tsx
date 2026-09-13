import type { ReactNode } from 'react';

const CLASES_CONTROL =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-marca-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';

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
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {etiqueta}
        {requerido && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}

export const clasesControl = CLASES_CONTROL;
