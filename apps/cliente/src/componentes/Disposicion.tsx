import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { Logotipo } from './Logotipo';

const SECCIONES = [
  {
    ruta: '/',
    texto: 'Mis clases',
    icono: 'M8 2v3M16 2v3M3.5 9h17M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  },
  { ruta: '/reservar', texto: 'Reservar', icono: 'M12 5v14M5 12h14' },
  {
    ruta: '/pagar',
    texto: 'Pagar',
    icono: 'M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  },
  {
    ruta: '/perfil',
    texto: 'Mi perfil',
    icono: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  },
];

/**
 * Disposición de la PWA: barra de marca arriba, navegación abajo.
 *
 * La navegación va abajo y no arriba porque en el teléfono es la zona que se
 * alcanza con el pulgar sin cambiar el agarre. La barra de arriba no navega:
 * está para que la app se reconozca como de la academia, con el mismo logotipo
 * del sitio y del panel.
 *
 * Las dos barras respetan las zonas seguras del teléfono (`safe-area-inset`):
 * sin eso, en un iPhone la barra de abajo queda tapada por la franja de gestos.
 */
export function Disposicion({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-carbon-950 pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Logotipo etiqueta="Alumnos" className="text-lg" />

          {/* El manual va acá y no en la barra de abajo: esa tiene cuatro
              secciones y una quinta la deja apretada en un teléfono chico.
              El signo de pregunta arriba a la derecha es donde se lo busca. */}
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
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-24 pt-6">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
        aria-label="Secciones"
      >
        <ul className="mx-auto flex max-w-lg">
          {SECCIONES.map((seccion) => (
            <li key={seccion.ruta} className="flex-1">
              <NavLink
                to={seccion.ruta}
                end={seccion.ruta === '/'}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-1 py-2.5 text-xs transition ${
                    isActive ? 'font-semibold text-marca-600' : 'text-slate-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d={seccion.icono}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {seccion.texto}
                    {/* Marca de sección activa, como la del panel. El color no es
                        el único indicador: el texto también pasa a negrita. */}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-6 top-0 h-0.5 rounded-full bg-marca-600 transition-transform duration-300 ${
                        isActive ? 'scale-x-100' : 'scale-x-0'
                      }`}
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
