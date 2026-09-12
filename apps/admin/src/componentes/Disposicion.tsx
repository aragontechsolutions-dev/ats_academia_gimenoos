import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useSesion } from '../lib/sesion';

const secciones = [
  { ruta: '/', texto: 'Inicio', exacto: true },
  { ruta: '/servicios', texto: 'Servicios y precios', exacto: false },
];

export function Disposicion({ children }: { children: ReactNode }) {
  const { perfil, cerrarSesion } = useSesion();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-bold text-marca-900">Gimenoos · Panel</span>
          <nav className="flex flex-1 gap-4" aria-label="Secciones del panel">
            {secciones.map((seccion) => (
              <NavLink
                key={seccion.ruta}
                to={seccion.ruta}
                end={seccion.exacto}
                className={({ isActive }) =>
                  `text-sm ${isActive ? 'font-semibold text-marca-600' : 'text-slate-600'}`
                }
              >
                {seccion.texto}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {perfil && <span className="hidden text-slate-500 sm:inline">{perfil.email}</span>}
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-slate-400"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
