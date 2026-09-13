import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface ItemRemoto {
  titulo: string;
  detalle?: string;
}

export interface SeccionRemota {
  clave: string;
  visible: boolean;
  orden: number;
  titulo: string | null;
  bajada: string | null;
  etiqueta: string | null;
  accion: string | null;
  items: ItemRemoto[];
}

export interface NegocioRemoto {
  nombre: string;
  direccion: string | null;
  ciudad: string;
  departamento: string;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  horarios: string | null;
  mapaUrl: string | null;
  /** Punto exacto del local. Null las dos mientras nadie lo marque en el panel. */
  latitud: number | null;
  longitud: number | null;
  instagram: string | null;
  facebook: string | null;
}

export interface ContenidoRemoto {
  negocio: NegocioRemoto | null;
  secciones: Record<string, SeccionRemota>;
}

/** Nada cargado todavía: el sitio usa sus textos por defecto. */
const VACIO: ContenidoRemoto = { negocio: null, secciones: {} };

/**
 * Trae el contenido que la academia configuró desde el panel.
 *
 * Si la API no responde se devuelve el contenido vacío y el sitio queda con los
 * textos por defecto de `contenido.ts`. Esto no es un detalle: la landing es la
 * cara pública del negocio y tiene que seguir en pie aunque el backend esté
 * caído. Por eso el contenido del código no se borra cuando se agrega el panel,
 * se convierte en el respaldo.
 */
export async function obtenerContenidoRemoto(): Promise<ContenidoRemoto> {
  try {
    const respuesta = await fetch(`${API_URL}/landing/contenido`);
    if (!respuesta.ok) return VACIO;

    const datos = (await respuesta.json()) as {
      negocio: NegocioRemoto | null;
      secciones: SeccionRemota[];
    };

    const secciones: Record<string, SeccionRemota> = {};
    for (const seccion of datos.secciones ?? []) {
      // Se normalizan los ítems acá y no en cada componente: el contenido viene
      // de una columna JSON, y lo que la base devuelve no está tipado.
      secciones[seccion.clave] = {
        ...seccion,
        items: Array.isArray(seccion.items)
          ? seccion.items.filter(
              (item): item is ItemRemoto =>
                typeof item === 'object' && item !== null && typeof item.titulo === 'string',
            )
          : [],
      };
    }

    return { negocio: datos.negocio ?? null, secciones };
  } catch {
    return VACIO;
  }
}

export function useContenidoRemoto(): { contenido: ContenidoRemoto; cargando: boolean } {
  const [contenido, setContenido] = useState<ContenidoRemoto>(VACIO);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    void obtenerContenidoRemoto().then((datos) => {
      if (!vigente) return;
      setContenido(datos);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  return { contenido, cargando };
}

/**
 * Elige entre el texto configurado y el del código.
 *
 * Una cadena vacía o con solo espacios cuenta como "no configurado": si alguien
 * borra el título desde el panel, la intención es volver al texto por defecto,
 * no dejar el encabezado en blanco.
 */
export function texto(remoto: string | null | undefined, porDefecto: string): string {
  if (typeof remoto !== 'string') return porDefecto;
  const limpio = remoto.trim();
  return limpio === '' ? porDefecto : limpio;
}

/** Igual que `texto`, pero para datos que pueden legítimamente no existir. */
export function dato(remoto: string | null | undefined, porDefecto: string | null): string | null {
  if (typeof remoto !== 'string') return porDefecto;
  const limpio = remoto.trim();
  return limpio === '' ? null : limpio;
}

/** Los ítems configurados, o los del código si no hay ninguno cargado. */
export function items<T>(
  remotos: ItemRemoto[] | undefined,
  porDefecto: T[],
  adaptar: (item: ItemRemoto, indice: number) => T,
): T[] {
  if (!remotos || remotos.length === 0) return porDefecto;
  return remotos.map(adaptar);
}
