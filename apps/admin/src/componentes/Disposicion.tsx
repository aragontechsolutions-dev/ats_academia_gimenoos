import { useState, type ComponentType, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  Car,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Receipt,
  Tags,
  UserCog,
  Users,
  Globe,
  BookOpen,
} from 'lucide-react';

import { useSesion } from '../lib/sesion';

/**
 * Sin marca de «solo admin»: al panel entra solo administración, así que todas
 * las secciones se ven siempre. La distinción existía para el instructor, que
 * desde la Etapa 2.D tiene su propia app.
 *
 * Once secciones no entran escritas en una sola fila: en una pantalla de
 * portátil los nombres se apretaban hasta partirse en dos renglones y el
 * encabezado crecía. En el escritorio va el ícono solo, con el nombre en un
 * globo al dejar el mouse; en el teléfono, donde el menú es vertical y sobra
 * alto, va el ícono **y** el nombre.
 */
const SECCIONES: { ruta: string; texto: string; exacto: boolean; Icono: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }> }[] = [
  { ruta: '/', texto: 'Resumen', exacto: true, Icono: LayoutDashboard },
  { ruta: '/agenda', texto: 'Agenda', exacto: false, Icono: CalendarDays },
  { ruta: '/alumnos', texto: 'Alumnos', exacto: false, Icono: Users },
  { ruta: '/instructores', texto: 'Instructores', exacto: false, Icono: UserCog },
  { ruta: '/vehiculos', texto: 'Vehículos', exacto: false, Icono: Car },
  { ruta: '/servicios', texto: 'Precios', exacto: false, Icono: Tags },
  { ruta: '/pagos', texto: 'Pagos', exacto: false, Icono: Receipt },
  { ruta: '/graduados', texto: 'Egresados', exacto: false, Icono: GraduationCap },
  { ruta: '/sitio', texto: 'Sitio web', exacto: false, Icono: Globe },
  { ruta: '/cuentas', texto: 'Cuentas', exacto: false, Icono: KeyRound },
  { ruta: '/avisos', texto: 'Avisos', exacto: false, Icono: Bell },
  { ruta: '/manuales', texto: 'Manuales', exacto: false, Icono: BookOpen },
];

export function Disposicion({ children }: { children: ReactNode }) {
  const { perfil, cerrarSesion } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);


  /**
   * Los enlaces del encabezado: solo el ícono, con el nombre en un globo.
   *
   * El nombre **está** en el marcado, como `sr-only`: así el nombre accesible
   * del enlace es «Pagos» y no queda un enlace sin texto. El globo es
   * decoración (`aria-hidden`) y no se anuncia dos veces.
   *
   * La demora de medio segundo vive en la clase, no en un temporizador de
   * JavaScript: `group-hover:delay-500` retrasa la aparición, y como el estado
   * de reposo no tiene demora, el globo se va enseguida al sacar el mouse. Un
   * globo que tarda tanto en irse como en venir se siente pegajoso.
   */
  const enlacesDeEscritorio = (
    <>
      {SECCIONES.map(({ ruta, texto, exacto, Icono }) => (
        <NavLink
          key={ruta}
          to={ruta}
          end={exacto}
          className={({ isActive }) =>
            `group relative rounded-lg p-2 transition ${
              isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icono size={20} aria-hidden />
              <span className="sr-only">{texto}</span>

              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-carbon-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/15 transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-500 group-focus-visible:opacity-100"
              >
                {texto}
              </span>

              <span
                aria-hidden="true"
                className={`absolute inset-x-1 -bottom-0.5 h-0.5 origin-left rounded-full bg-acento-400 transition-transform duration-300 ${
                  isActive ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </>
          )}
        </NavLink>
      ))}
    </>
  );

  /** En el teléfono el menú es vertical: hay lugar para el nombre entero. */
  const enlacesDelTelefono = (
    <>
      {SECCIONES.map(({ ruta, texto, exacto, Icono }) => (
        <NavLink
          key={ruta}
          to={ruta}
          end={exacto}
          onClick={() => setMenuAbierto(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition ${
              isActive ? 'bg-white/10 font-semibold text-white' : 'text-slate-300'
            }`
          }
        >
          <Icono size={18} aria-hidden />
          {texto}
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

          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Secciones del panel">
            {enlacesDeEscritorio}
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
            {enlacesDelTelefono}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
