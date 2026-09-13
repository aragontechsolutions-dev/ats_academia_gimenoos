import type { ButtonHTMLAttributes } from 'react';

const VARIANTES = {
  primario: 'bg-marca-500 text-white hover:bg-marca-600 shadow-sm shadow-marca-500/20',
  secundario: 'border border-slate-300 text-slate-700 hover:border-slate-400',
  peligro: 'border border-red-300 text-red-700 hover:bg-red-50',
} as const;

export function Boton({
  variante = 'primario',
  className = '',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof VARIANTES }) {
  return (
    <button
      {...resto}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${VARIANTES[variante]} ${className}`}
    />
  );
}
