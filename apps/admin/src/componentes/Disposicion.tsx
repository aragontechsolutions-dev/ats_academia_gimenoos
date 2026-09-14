import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useSesion } from '../lib/sesion';

/**
 * Sin marca de «solo admin»: al panel entra solo administración, así que todas
 * las secciones se ven siempre. La distinción existía para el instructor, que
 * desde la Etapa 2.D tiene su propia app.
 */
const SECCIONES = [
  { ruta: '/', texto: 'Agenda', exacto: true },
  { ruta: '/alumnos', texto: 'Alumnos', exacto: false },
  { ruta: '/instructores', texto: 'Instructores', exacto: false },
  { ruta: '/vehiculos', texto: 'Vehículos', exacto: false },
  { ruta: '/servicios', texto: 'Precios', exacto: false },
  { ruta: '/graduados', texto: 'Egresados', exacto: false },
  { ruta: '/sitio', texto: 'Sitio web', exacto: false },
  { ruta: '/cuentas', texto: 'Cuentas', exacto: false },
];

export function Disposicion({ children }: { children: ReactNode }) {
  const { perfil, cerrarSesion } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);


  const enlaces = (
    <>
      {SECCIONES.map((seccion) => (
        <NavLink
          key={seccion.ruta}
          to={seccion.ruta}
          end={seccion.exacto}
          onClick={() => setMenuAbierto(false)}
          className={({ isActive }) =>
            `relative block py-2 text-sm transition md:py-0 ${
              isActive ? 'font-semibold text-white' : 'text-slate-300 hover:text-acento-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {seccion.texto}
              <span
                aria-hidden="true"
                className={`absolute -bottom-0.5 left-0 h-0.5 w-full origin-left rounded-full bg-acento-400 transition-transform duration-300 ${
                  isActive ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </>
          )}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen">
      <header className="bg-carbon-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* El mismo logotipo que el sitio público: la academia es una sola. */}
          <span className="flex items-baseline gap-1 text-lg font-extrabold tracking-tight">
            GIMENOOS
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-marca-500" />
            <span className="ml-2 hidden text-xs font-medium uppercase tracking-widest text-slate-400 sm:inline">
              Panel
            </span>
          </span>

          <nav className="hidden flex-1 gap-6 md:flex" aria-label="Secciones del panel">
            {enlaces}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            {perfil && <span className="hidden text-slate-400 lg:inline">{perfil.email}</span>}
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              className="rounded-lg border border-white/25 px-3 py-1.5 text-white transition hover:border-white hover:bg-white/10"
            >
              Salir
            </button>
            <button
              type="button"
              className="rounded p-1 text-white md:hidden"
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
          <nav className="border-t border-white/10 px-4 py-2 md:hidden" aria-label="Secciones">
            {enlaces}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
