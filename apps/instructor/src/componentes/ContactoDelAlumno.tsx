import { numeroParaWhatsApp } from '../lib/whatsapp';

/**
 * Sólo `+` y dígitos. Lo que no encaje no se convierte en un enlace `tel:`.
 *
 * El número viene de la API, que lo guarda normalizado, así que en la práctica
 * siempre encaja. La comprobación está igual porque acá se arma una dirección
 * con un dato de la base: si mañana entra un número por otra vía, el peor caso
 * es que no aparezca el botón, no que se arme un enlace raro.
 */
const NUMERO_LIMPIO = /^\+?[0-9]+$/;

function paraLlamar(telefono: string | null): string | null {
  if (!telefono) return null;
  const compacto = telefono.replace(/[\s()-]/g, '');
  return NUMERO_LIMPIO.test(compacto) ? compacto : null;
}

/**
 * Llamar y escribir al alumno, con el pulgar.
 *
 * Son las dos cosas que hacen falta cuando el alumno no aparece en el punto de
 * encuentro, y por eso son botones grandes y no dos enlaces subrayados dentro de
 * la lista de datos: se tocan parado al lado del auto, sin apuntar.
 *
 * Las dos hacen falta y no una: llamar sirve cuando el alumno está por llegar,
 * y el mensaje queda escrito cuando no atiende.
 *
 * Si no hay número no se dibuja nada. Un botón que no llama a nadie es peor que
 * ningún botón.
 */
export function ContactoDelAlumno({
  telefono,
  nombre,
}: {
  telefono: string | null;
  /** Va en el texto para lectores de pantalla: «Llamar a Ana». */
  nombre: string;
}) {
  const llamar = paraLlamar(telefono);
  const whatsapp = numeroParaWhatsApp(telefono);

  if (!llamar && !whatsapp) return null;

  return (
    <div className="flex gap-2">
      {llamar && (
        <a
          href={`tel:${llamar}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 3 5a1 1 0 0 1 1-1z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Llamar
          <span className="sr-only"> a {nombre}</span>
        </a>
      )}

      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-green-600 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8.8 8.4c.3-.7.6-.7.9-.7h.7c.2 0 .5 0 .7.6l.7 1.6c.1.3 0 .5-.1.7l-.4.5c-.2.2-.3.4-.1.7a6 6 0 0 0 2.6 2.3c.3.2.5.1.7-.1l.5-.6c.2-.2.4-.2.6-.1l1.6.8c.3.2.4.3.4.5 0 .5-.2 1.2-.5 1.5-.4.3-1 .6-1.6.5a9 9 0 0 1-6.6-6.5c-.1-.6 0-1.2.4-1.7z"
              fill="currentColor"
            />
          </svg>
          WhatsApp
          <span className="sr-only"> a {nombre}</span>
        </a>
      )}
    </div>
  );
}
