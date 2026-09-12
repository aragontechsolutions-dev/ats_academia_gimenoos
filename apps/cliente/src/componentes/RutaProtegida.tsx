import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSesion } from '../lib/sesion';

/**
 * Comodidad de interfaz, no control de seguridad: la autorizacion real
 * la aplica la API. Ver apps/admin/src/componentes/RutaProtegida.tsx.
 */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { sesion, cargando } = useSesion();

  if (cargando) return <p className="p-8 text-slate-500">Cargando…</p>;
  if (!sesion) return <Navigate to="/ingresar" replace />;

  return <>{children}</>;
}
