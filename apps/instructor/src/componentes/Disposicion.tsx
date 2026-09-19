import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { Logotipo } from './Logotipo';
import { useSesion } from '../lib/sesion';

/**
 * Disposición de la app: barra de marca arriba y nada más.
 *
 * A diferencia de la app del alumno, acá NO hay navegación inferior: por ahora
 * la app tiene una sola pantalla —la agenda— y una barra con un solo botón es
 * ruido. Cuando haya una segunda sección se agrega, con el mismo criterio de
 * ponerla abajo: en el teléfono es la zona que alcanza el pulgar.
 *
 * Las zonas seguras del teléfono (`safe-area-inset`) se respetan igual: sin eso,
 * en un iPhone el encabezado queda debajo de la barra de estado.
 */
export function Disposicion({ children }: { children: ReactNode }) {
  const { perfil, cerrarSesion } = useSesion();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-carbon-950 pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Logotipo etiqueta="Instructores" className="text-lg" />
          <div className="flex items-center gap-2">
            {/* El signo de pregunta, donde se lo busca. Esta app no tiene barra
                de navegación —es una sola pantalla—, así que el encabezado es
                el único lugar posible. */}
            <NavLink
              to="/manual"
              aria-label="Manual de uso"
              className={({ isActive }) =>
                `flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition ${
                  isActive
                    ? 'border-white bg-white text-carbon-950'
                    : 'border-white/30 text-white hover:border-white'
                }`
              }
            >
              ?
            </NavLink>
          {perfil && (
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:text-white"
            >
              Salir
            </button>
          )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6">
        {children}
      </main>
    </div>
  );
}
