import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { negocio as negocioPorDefecto, MENSAJE_WHATSAPP } from '../contenido';
import {
  useContenidoRemoto,
  dato,
  type ItemRemoto,
  type SeccionRemota,
} from '../lib/contenidoRemoto';

/**
 * Datos del negocio ya resueltos: lo que cargó la academia desde el panel, y
 * donde no cargó nada, lo que dice el código.
 */
export interface NegocioResuelto {
  nombre: string;
  nombreCorto: string;
  descripcionCorta: string;
  ciudad: string;
  departamento: string;
  pais: string;
  whatsapp: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  horarios: string | null;
  mapaUrl: string | null;
  instagram: string | null;
  facebook: string | null;
  sitioUrl: string;
}

interface ValorContexto {
  negocio: NegocioResuelto;
  secciones: Record<string, SeccionRemota>;
  cargando: boolean;
}

const Contexto = createContext<ValorContexto | null>(null);

export function ProveedorContenido({ children }: { children: ReactNode }) {
  const { contenido, cargando } = useContenidoRemoto();

  const valor = useMemo<ValorContexto>(() => {
    const remoto = contenido.negocio;

    return {
      negocio: {
        // Estos cuatro son identidad del sitio, no datos de contacto: no se
        // editan desde el panel porque cambiarlos implica revisar el SEO, los
        // textos legales y el logo.
        nombreCorto: negocioPorDefecto.nombreCorto,
        descripcionCorta: negocioPorDefecto.descripcionCorta,
        pais: negocioPorDefecto.pais,
        sitioUrl: negocioPorDefecto.sitioUrl,

        nombre: remoto?.nombre ?? negocioPorDefecto.nombre,
        ciudad: remoto?.ciudad ?? negocioPorDefecto.ciudad,
        departamento: remoto?.departamento ?? negocioPorDefecto.departamento,
        whatsapp: dato(remoto?.whatsapp, negocioPorDefecto.whatsapp),
        telefono: dato(remoto?.telefono, negocioPorDefecto.telefono),
        email: dato(remoto?.email, negocioPorDefecto.email),
        direccion: dato(remoto?.direccion, negocioPorDefecto.direccion),
        horarios: dato(remoto?.horarios, negocioPorDefecto.horarios),
        mapaUrl: dato(remoto?.mapaUrl, negocioPorDefecto.mapaUrl),
        instagram: dato(remoto?.instagram, negocioPorDefecto.instagram),
        facebook: dato(remoto?.facebook, negocioPorDefecto.facebook),
      },
      secciones: contenido.secciones,
      cargando,
    };
  }, [contenido, cargando]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

function usarContexto(): ValorContexto {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('Falta <ProveedorContenido> alrededor de este componente');
  return valor;
}

export function useNegocio(): NegocioResuelto {
  return usarContexto().negocio;
}

/** Configuración de una sección. Devuelve valores seguros si no hay nada cargado. */
export function useSeccion(clave: string): {
  visible: boolean;
  titulo: string | null;
  bajada: string | null;
  etiqueta: string | null;
  accion: string | null;
  items: ItemRemoto[];
} {
  const { secciones } = usarContexto();
  const seccion = secciones[clave];

  return {
    // Sin configuración guardada la sección se muestra. Es lo correcto: el sitio
    // tiene que funcionar completo desde el primer día, antes de que nadie entre
    // al panel.
    visible: seccion?.visible ?? true,
    titulo: seccion?.titulo ?? null,
    bajada: seccion?.bajada ?? null,
    etiqueta: seccion?.etiqueta ?? null,
    accion: seccion?.accion ?? null,
    items: seccion?.items ?? [],
  };
}

/** El orden configurado de una sección, o null si nadie lo tocó. */
export function useOrdenSecciones(): Record<string, number> {
  const { secciones } = usarContexto();
  return useMemo(() => {
    const orden: Record<string, number> = {};
    for (const [clave, seccion] of Object.entries(secciones)) orden[clave] = seccion.orden;
    return orden;
  }, [secciones]);
}

/**
 * Enlace de WhatsApp con el número vigente.
 *
 * Devuelve null si todavía no hay número cargado: los componentes usan eso para
 * no dibujar un botón que no lleva a ninguna parte.
 */
export function useEnlaceWhatsApp(mensaje: string = MENSAJE_WHATSAPP): string | null {
  const { whatsapp } = useNegocio();
  return construirEnlaceWhatsApp(whatsapp, mensaje);
}

/**
 * La misma lógica, como función pura.
 *
 * El formulario de contacto arma el enlace dentro del manejador de envío, con el
 * mensaje que escribió la persona, y ahí no se pueden llamar hooks. Antes que
 * duplicar el armado del enlace en dos lugares, se comparte esta función.
 */
export function construirEnlaceWhatsApp(
  whatsapp: string | null,
  mensaje: string = MENSAJE_WHATSAPP,
): string | null {
  if (!whatsapp) return null;
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

/** Destino del CTA principal: WhatsApp si está configurado, si no el formulario. */
export function useDestinoPrincipal(): { href: string; externo: boolean } {
  const wa = useEnlaceWhatsApp();
  return wa ? { href: wa, externo: true } : { href: '#contacto', externo: false };
}
