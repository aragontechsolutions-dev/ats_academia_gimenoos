import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { llamarApi } from './api';

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  rol: 'ADMIN' | 'INSTRUCTOR' | 'CLIENTE';
  activo: boolean;
}

interface ContextoSesion {
  sesion: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Sesion inicial (puede venir de localStorage o del enlace mágico en la URL).
    void supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
    });

    return () => suscripcion.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      return;
    }
    // El rol se consulta a la API, que lo lee de la base: nunca se confia en
    // los claims del token del navegador para decidir que se muestra.
    void llamarApi<Perfil>('/usuarios/me')
      .then(setPerfil)
      .catch(() => setPerfil(null));
  }, [sesion]);

  const valor = useMemo<ContextoSesion>(
    () => ({
      sesion,
      perfil,
      cargando,
      cerrarSesion: async () => {
        await supabase.auth.signOut();
      },
    }),
    [sesion, perfil, cargando],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return contexto;
}
