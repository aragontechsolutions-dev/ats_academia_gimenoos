import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    /**
     * Una entrada por campo, cuando lo que falló fue la validación.
     *
     * Va aparte del mensaje porque se muestra distinto: el mensaje es el título
     * del aviso y esto es la lista de cosas para corregir, una por renglón.
     */
    readonly detalles: string[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

/** Lo que decimos cuando la respuesta no trae ningún texto propio. */
function segunElCodigo(estado: number): string {
  if (estado === 401) return 'Tu sesión venció. Volvé a entrar.';
  if (estado === 403) return 'Tu cuenta no tiene permiso para hacer eso.';
  if (estado === 404) return 'No encontramos lo que pediste.';
  if (estado === 429) return 'Demasiados intentos seguidos. Esperá un momento.';
  if (estado >= 500) return 'El servidor tuvo un problema. Probá de nuevo en un momento.';
  return 'No se pudo completar la operación.';
}

/**
 * Saca de la respuesta el mensaje que se le va a mostrar a una persona.
 *
 * `message` viene de dos formas según qué falló, y la diferencia importa:
 *
 * - Un **texto**, cuando es una regla del negocio: «Ese instructor ya tiene una
 *   clase en el horario seleccionado». Ese texto ya está escrito para leerse.
 * - Una **lista**, cuando falló la validación: una entrada por campo.
 *
 * Antes se pasaba lo que viniera al constructor del Error. Con una lista, eso
 * daba un solo renglón con todo pegado por comas, que es justo lo que no se
 * entiende cuando hay tres campos mal.
 */
function leerProblema(cuerpo: unknown, estado: number): { mensaje: string; detalles: string[] } {
  const message = (cuerpo as { message?: unknown } | null)?.message;

  if (Array.isArray(message)) {
    const detalles = message.filter((m): m is string => typeof m === 'string' && m.length > 0);
    if (detalles.length === 0) return { mensaje: segunElCodigo(estado), detalles: [] };
    if (detalles.length === 1) return { mensaje: detalles[0]!, detalles: [] };
    return { mensaje: `Hay ${detalles.length} datos para corregir`, detalles };
  }

  if (typeof message === 'string' && message.length > 0) return { mensaje: message, detalles: [] };

  return { mensaje: segunElCodigo(estado), detalles: [] };
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
    const cuerpo: unknown = await respuesta.json().catch(() => null);
    const { mensaje, detalles } = leerProblema(cuerpo, respuesta.status);
    throw new ErrorApi(respuesta.status, mensaje, detalles);
  }

  // Una respuesta sin cuerpo NO es un error. Los endpoints que no tienen nada
  // que devolver contestan 204, y `json()` sobre un cuerpo vacio lanza
  // «Unexpected end of JSON input». Antes eso convertia una operacion que habia
  // salido bien en un error en pantalla: el dato se guardaba y al usuario se le
  // decia que no.
  if (respuesta.status === 204 || respuesta.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return (await respuesta.json()) as T;
}
