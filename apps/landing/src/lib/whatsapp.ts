import { MENSAJE_WHATSAPP, negocio } from '../contenido';

/**
 * Arma el enlace de WhatsApp.
 *
 * Devuelve null si todavía no se cargó el número: los componentes usan eso para
 * no mostrar un botón que no lleva a ninguna parte. Un CTA roto convierte peor
 * que no tener CTA.
 */
export function enlaceWhatsApp(mensaje: string = MENSAJE_WHATSAPP): string | null {
  if (!negocio.whatsapp) return null;
  return `https://wa.me/${negocio.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

/** Destino del CTA principal: WhatsApp si está configurado, si no el formulario. */
export function destinoPrincipal(): { href: string; externo: boolean } {
  const wa = enlaceWhatsApp();
  return wa ? { href: wa, externo: true } : { href: '#contacto', externo: false };
}
