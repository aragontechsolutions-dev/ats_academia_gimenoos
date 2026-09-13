import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const SECCIONES = [
  {
    ruta: '/',
    texto: 'Mis clases',
    icono: 'M8 2v3M16 2v3M3.5 9h17M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  },
  { ruta: '/reservar', texto: 'Reservar', icono: 'M12 5v14M5 12h14' },
  {
    ruta: '/perfil',
    texto: 'Mi perfil',
    icono: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  },
];

/**
 * Disposición de la PWA: barra inferior fija.
 *
 * La navegación va abajo y no arriba porque en el teléfono es la zona que se
 * alcanza con el pulgar sin cambiar el agarre.
 */
export function Disposicion({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>

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
                  `flex flex-col items-center gap-1 py-2.5 text-xs ${
                    isActive ? 'font-semibold text-marca-600' : 'text-slate-500'
                  }`
                }
              >
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
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
