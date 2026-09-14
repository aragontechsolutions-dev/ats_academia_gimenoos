import type { ReactNode } from 'react';

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
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6">
        {children}
      </main>
    </div>
  );
}
