/**
 * Enlaces a WhatsApp desde el panel.
 *
 * Se usa `wa.me`, que abre la aplicación con el mensaje ya escrito. **El envío
 * lo aprieta la persona**: no es automático. Mandarlo automáticamente requeriría
 * la API de WhatsApp Business —cuenta de empresa en Meta, plantillas aprobadas,
 * un proveedor y costo por mensaje—, que es un proyecto aparte.
 */

/**
 * Deja un teléfono como lo quiere `wa.me`: solo dígitos, con código de país y
 * sin el `+`.
 *
 * Los teléfonos se guardan como `+598 98663201`. Pasarle eso a `wa.me` tal cual
 * abre un chat con un número inexistente, sin ningún error visible.
 */
export function numeroParaWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, '');
  // Menos de 8 dígitos no es un número que se pueda llamar; más de 15 no existe
  // (E.164 topea ahí).
  return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
}

/** Abre WhatsApp con el mensaje listo para enviar. */
export function abrirWhatsApp(telefono: string, mensaje: string): boolean {
  const numero = numeroParaWhatsApp(telefono);
  if (!numero) return false;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
  return true;
}

/** El mensaje que se le manda al alumno con su enlace de acceso. */
export function mensajeDeAcceso(nombre: string, enlace: string, academia = 'Academia Gimenoos'): string {
  return [
    `¡Hola ${nombre}! Te habilitamos el acceso a la app de ${academia}.`,
    '',
    'Desde ahí vas a poder ver tus clases y reservar horarios:',
    enlace,
    '',
    'El enlace vence en 24 horas y se usa una sola vez. Si se te venció, avisanos y te mandamos otro.',
  ].join('\n');
}
