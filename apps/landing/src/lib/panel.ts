/**
 * Acceso al panel de administración desde el sitio público.
 *
 * El enlace al panel NO se publica: el sitio es para alumnos y para quien busca
 * clases, y un botón de "ingresar" ahí sólo genera confusión y visitas a una
 * pantalla que no les sirve. El personal llega con un atajo (Ctrl + Shift + clic
 * en el logo).
 *
 * IMPORTANTE, y conviene que quede escrito: esto es discreción, NO seguridad.
 * La dirección del panel es pública igual, y quien la conozca puede abrirla. Lo
 * que protege el panel es la autenticación de Supabase más la verificación del
 * rol contra la base en cada petición; esconder el enlace no agrega ni quita
 * nada a eso. Si alguna vez se necesita que el panel no sea alcanzable desde
 * afuera, eso se resuelve en el despliegue, no acá.
 */
const PANEL_URL = import.meta.env.VITE_PANEL_URL ?? 'http://localhost:5174';

/** Pantalla de ingreso del panel. La ruta la define `apps/admin`. */
export function urlIngresoPanel(): string {
  return `${PANEL_URL.replace(/\/$/, '')}/ingresar`;
}

/** ¿El evento trae la combinación del atajo? */
export function esAtajoDePanel(evento: { ctrlKey: boolean; shiftKey: boolean }): boolean {
  return evento.ctrlKey && evento.shiftKey;
}
