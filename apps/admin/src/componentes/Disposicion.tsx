import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useSesion } from '../lib/sesion';

const SECCIONES = [
  { ruta: '/', texto: 'Agenda', exacto: true },
  { ruta: '/alumnos', texto: 'Alumnos', exacto: false },
  { ruta: '/instructores', texto: 'Instructores', exacto: false, soloAdmin: true },
  { ruta: '/vehiculos', texto: 'Vehículos', exacto: false, soloAdmin: true },
  { ruta: '/servicios', texto: 'Precios', exacto: false, soloAdmin: true },
];

export function Disposicion({ children }: { children: ReactNode }) {
  const { perfil, cerrarSesion } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const visibles = SECCIONES.filter((s) => !s.soloAdmin || perfil?.rol === 'ADMIN');

  const enlaces = (
    <>
      {visibles.map((seccion) => (
        <NavLink
          key={seccion.ruta}
          to={seccion.ruta}
          end={seccion.exacto}
          onClick={() => setMenuAbierto(false)}
          className={({ isActive }) =>
            `block py-2 text-sm md:py-0 ${
              isActive ? 'font-semibold text-marca-600' : 'text-slate-600 hover:text-slate-900'
            }`
          }
        >
          {seccion.texto}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-bold text-marca-900">Gimenoos</span>

          <nav className="hidden flex-1 gap-6 md:flex" aria-label="Secciones del panel">
            {enlaces}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            {perfil && <span className="hidden text-slate-500 lg:inline">{perfil.email}</span>}
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-slate-400"
            >
              Salir
            </button>
            <button
              type="button"
              className="rounded p-1 text-slate-600 md:hidden"
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((abierto) => !abierto)}
            >
              <span className="sr-only">Menú</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d={menuAbierto ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {menuAbierto && (
          <nav className="border-t border-slate-200 px-4 py-2 md:hidden" aria-label="Secciones">
            {enlaces}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
