import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ErrorApi, llamarApi } from './api';

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
  /** Por qué no se pudo traer el perfil, si no se pudo. */
  errorPerfil: string | null;
  /** Vuelve a intentarlo, sin cerrar la sesión ni recargar la página. */
  reintentarPerfil: () => void;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);

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

  /**
   * Pide el perfil, y **guarda el motivo si no se pudo**.
   *
   * Antes el error se tragaba con un `catch` vacío y el perfil quedaba en null.
   * Como las pantallas protegidas muestran «Cargando…» mientras no hay perfil,
   * cualquier fallo dejaba la app colgada en esa palabra para siempre, sin decir
   * nada. Pasó en producción por una variable de entorno mal cargada: la API
   * respondía 404 y la persona veía «Cargando…» indefinidamente.
   *
   * Un fallo acá casi siempre es una de dos cosas, y las dos se resuelven mejor
   * si se ven: la cuenta no está habilitada (la API lo dice con un mensaje para
   * personas), o la app no está llegando a la API.
   */
  const pedirPerfil = useCallback(() => {
    setErrorPerfil(null);
    // El rol se consulta a la API, que lo lee de la base: nunca se confia en
    // los claims del token del navegador para decidir que se muestra.
    void llamarApi<Perfil>('/usuarios/me')
      .then((datos) => {
        setPerfil(datos);
        setErrorPerfil(null);
      })
      .catch((problema: Error) => {
        setPerfil(null);
        // El código HTTP va en el texto a propósito: un 403 es «tu cuenta no
        // está habilitada» y un 404 es «esta app no está pegándole a la API».
        // Sin el número, los dos se leen igual y no se distinguen a distancia.
        setErrorPerfil(
          problema instanceof ErrorApi
            ? `${problema.message} (${problema.estado})`
            : problema.message,
        );
      });
  }, []);

  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      setErrorPerfil(null);
      return;
    }
    pedirPerfil();
  }, [sesion, pedirPerfil]);

  const valor = useMemo<ContextoSesion>(
    () => ({
      sesion,
      perfil,
      cargando,
      errorPerfil,
      reintentarPerfil: pedirPerfil,
      cerrarSesion: async () => {
        await supabase.auth.signOut();
      },
    }),
    [sesion, perfil, cargando, errorPerfil, pedirPerfil],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return contexto;
}
