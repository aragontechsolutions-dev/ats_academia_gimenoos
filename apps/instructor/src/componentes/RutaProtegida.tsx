import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useSesion } from '../lib/sesion';
import { Logotipo } from './Logotipo';

/** A dónde mandar a quien se equivocó de app. Opcionales: sin la variable no se ofrece enlace. */
const APP_ALUMNO = import.meta.env.VITE_APP_ALUMNO_URL;
const APP_PANEL = import.meta.env.VITE_APP_PANEL_URL;

/**
 * Deja pasar solo a un instructor.
 *
 * Es comodidad de interfaz, no control de seguridad: la autorización real la
 * aplica la API, que acota cada consulta al rol de quien la hace. Acá se decide
 * qué se dibuja.
 *
 * Se comprueba el ROL además de la sesión, y eso es distinto de lo que hace la
 * app del alumno —que solo pide sesión—. Acá hace falta porque esta app y la del
 * alumno usan las mismas cuentas de Supabase: un alumno que llegue a esta
 * dirección tiene sesión válida y pasaría el guard, para encontrarse con una
 * agenda vacía y sin ninguna explicación. Es peor que decirle dónde tiene que ir.
 *
 * El rol NO se lee del token del navegador: `useSesion` lo pide a la API, que lo
 * lee de la base.
 */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { sesion, perfil, cargando } = useSesion();

  if (cargando) return <p className="p-8 text-slate-500">Cargando…</p>;
  if (!sesion) return <Navigate to="/ingresar" replace />;

  // La sesión ya está, pero todavía no se sabe quién es. Sin esta espera, la
  // pantalla de "esta app es para instructores" aparecería por un instante en
  // cada carga, incluso para un instructor.
  if (!perfil) return <p className="p-8 text-slate-500">Cargando…</p>;

  if (perfil.rol !== 'INSTRUCTOR') return <NoEsTuApp rol={perfil.rol} />;

  return <>{children}</>;
}

/** Quién sos y a dónde tenés que ir. Sin un callejón sin salida. */
function NoEsTuApp({ rol }: { rol: 'ADMIN' | 'CLIENTE' }) {
  const { cerrarSesion } = useSesion();
  const destino = rol === 'CLIENTE' ? APP_ALUMNO : APP_PANEL;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-carbon-950 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Logotipo className="justify-center text-2xl text-white" />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-xl shadow-black/30">
          <h1 className="text-xl font-bold text-slate-900">Esta app es para instructores</h1>
          <p className="mt-2 text-sm text-slate-600">
            {rol === 'CLIENTE'
              ? 'Tu cuenta es de alumno. Tus clases, y reservar una nueva, están en la app de alumnos.'
              : 'Tu cuenta es de administración. La agenda completa y el resto de la gestión están en el panel.'}
          </p>

          {destino && (
            <a
              href={destino}
              className="mt-5 block rounded-lg bg-marca-600 py-3 text-center font-semibold text-white transition hover:bg-marca-700"
            >
              {rol === 'CLIENTE' ? 'Ir a la app de alumnos' : 'Ir al panel'}
            </a>
          )}

          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="mt-3 w-full rounded-lg border border-slate-300 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
