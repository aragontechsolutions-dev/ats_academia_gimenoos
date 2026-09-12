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
  const { sesion, perfil, cargando } = useSesion();

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
      <div className="p-8">
        <h1 className="text-xl font-bold text-slate-900">Acceso restringido</h1>
        <p className="mt-2 text-slate-600">
          Tu cuenta no tiene permisos para usar el panel de administración.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
