import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';

/**
 * A dónde mandar a quien llegó acá con una cuenta que no es de administración.
 *
 * Son opcionales a propósito: si no están cargadas, la pantalla explica igual
 * dónde está su trabajo, solo que sin enlace. Una variable más que sea
 * obligatoria es una forma más de que el despliegue falle.
 */
const APP_INSTRUCTOR = import.meta.env.VITE_APP_INSTRUCTOR_URL;
const APP_ALUMNO = import.meta.env.VITE_APP_ALUMNO_URL;

/**
 * Deja pasar solo a administración.
 *
 * Hasta la Etapa 2.D el instructor también entraba acá: era el único lugar donde
 * podía ver su agenda. Ahora tiene su propia app, y el panel volvió a ser lo que
 * dice su nombre. No es solo una cuestión de orden: mientras el instructor tenga
 * la puerta abierta, cada pantalla nueva que se agregue al panel queda, por
 * omisión, a un paso suyo.
 *
 * Esto es una comodidad de interfaz, NO un control de seguridad: la autorizacion
 * real la aplica la API con sus guards. Un usuario que fuerce la ruta en el
 * navegador igual recibe 401/403 en cada peticion.
 */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { sesion, perfil, cargando, cerrarSesion } = useSesion();

  if (cargando) {
    return <p className="p-8 text-slate-500">Cargando…</p>;
  }

  if (!sesion) {
    return <Navigate to="/ingresar" replace />;
  }

  if (!perfil) {
    return <p className="p-8 text-slate-500">Verificando permisos…</p>;
  }

  if (perfil.rol !== 'ADMIN') {
    const esInstructor = perfil.rol === 'INSTRUCTOR';
    const destino = esInstructor ? APP_INSTRUCTOR : APP_ALUMNO;

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">
            {esInstructor ? 'Tu agenda está en la app' : 'Tus clases están en la app de alumnos'}
          </h1>
          {/* A nadie le sirve «no tenés permisos» a secas: lo que necesita es
              dónde está ahora su trabajo, y el enlace para llegar. */}
          <p className="mt-2 text-slate-600">
            {esInstructor
              ? 'Las clases del día, cerrarlas y anotar cómo fueron están en la app de instructores.'
              : 'Ver tus clases, reservar una nueva y tus datos están en la app de alumnos.'}
          </p>
          {destino && (
            <a
              href={destino}
              className="mt-5 inline-block rounded-lg bg-marca-600 px-4 py-2 font-semibold text-white transition hover:bg-marca-700"
            >
              {esInstructor ? 'Ir a la app de instructores' : 'Ir a la app de alumnos'}
            </a>
          )}
          {/* Saber con que cuenta se entro es lo primero que se necesita para
              resolverlo: casi siempre es la cuenta equivocada. */}
          <p className="mt-4 text-sm text-slate-500">
            Ingresaste como <span className="font-medium text-slate-700">{perfil.email}</span>
          </p>
          {/* Sin esta salida, quien entra con la cuenta equivocada queda
              atrapado: no hay forma de cambiar de usuario sin borrar los datos
              del sitio en el navegador. */}
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="mt-6 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:border-slate-400"
          >
            Salir e ingresar con otra cuenta
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
