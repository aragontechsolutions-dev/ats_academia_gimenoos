import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

/**
 * Llama a la API adjuntando el access token de Supabase.
 *
 * El token se lee de la sesion en cada llamada (y no se guarda en una variable)
 * para que siempre viaje el token vigente despues de un refresco automatico.
 */
export async function llamarApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as { message?: string } | null;
    throw new ErrorApi(respuesta.status, cuerpo?.message ?? 'Error al comunicarse con el servidor');
  }

  return (await respuesta.json()) as T;
}
