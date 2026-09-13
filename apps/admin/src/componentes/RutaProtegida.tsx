import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';

/**
 * Bloquea el acceso a las rutas del panel.
 *
 * Esto es una comodidad de interfaz, NO un control de seguridad: la autorizacion
 * real la aplica la API con sus guards. Un usuario que fuerce la ruta en el
 * navegador igual recibe 401/403 en cada peticion.
 */
export function RutaProtegida({
  children,
  rolesPermitidos = ['ADMIN', 'INSTRUCTOR'],
}: {
  children: ReactNode;
  rolesPermitidos?: Array<'ADMIN' | 'INSTRUCTOR' | 'CLIENTE'>;
}) {
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

  if (!rolesPermitidos.includes(perfil.rol)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Acceso restringido</h1>
          <p className="mt-2 text-slate-600">
            Esta cuenta no tiene permisos para usar el panel de administración.
          </p>
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
