import type { ReactNode } from 'react';

const VARIANTES = {
  // El rojo con texto blanco da 5.25 de contraste: cumple AA.
  primario: 'bg-marca-500 text-white hover:bg-marca-600 shadow-lg shadow-marca-500/25',
  // El amarillo lleva texto oscuro (12.31). Con texto blanco no alcanzaría.
  acento: 'bg-acento-400 text-carbon-950 hover:bg-acento-500',
  claro: 'bg-white text-carbon-950 hover:bg-slate-100',
  contorno: 'border-2 border-white/30 text-white hover:border-white hover:bg-white/10',
  contornoOscuro: 'border-2 border-carbon-950/15 text-carbon-950 hover:border-marca-500 hover:text-marca-600',
} as const;

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-base font-bold transition ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-acento-400 focus-visible:ring-offset-2 ' +
  // Se levanta apenas al pasar por encima: suficiente para que se sienta vivo,
  // sin convertirse en una animación que distrae.
  'hover:-translate-y-0.5 active:translate-y-0';

export function BotonEnlace({
  href,
  variante = 'primario',
  externo = false,
  children,
  className = '',
  onClick,
}: {
  href: string;
  variante?: keyof typeof VARIANTES;
  externo?: boolean;
  children: ReactNode;
  className?: string;
  /**
   * Se dispara antes de seguir el enlace, y no lo detiene.
   *
   * Lo usa el aviso de contacto por WhatsApp. No devuelve nada ni recibe el
   * evento a propósito: desde acá no se puede cancelar la navegación, que es
   * justo la garantía que hace falta.
   */
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={onClick}
      className={`${BASE} ${VARIANTES[variante]} ${className}`}
    >
      {children}
    </a>
  );
}

export const clasesBoton = (variante: keyof typeof VARIANTES = 'primario') =>
  `${BASE} ${VARIANTES[variante]}`;
