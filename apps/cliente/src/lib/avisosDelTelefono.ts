import { llamarApi } from './api';

/**
 * Los avisos en el teléfono del alumno.
 *
 * Todo lo que tiene que ver con el permiso del navegador y la suscripción vive
 * acá, y no dentro de un componente, porque son varias preguntas encadenadas que
 * se contestan distinto en cada navegador.
 *
 * **En iPhone sólo funciona con la app instalada.** Safari admite estos avisos
 * desde iOS 16.4, pero únicamente si la persona agregó la app a la pantalla de
 * inicio. Abierta en el navegador, `PushManager` directamente no existe. Por eso
 * `sePuede()` mira si existe y no la versión del sistema: la pregunta correcta
 * es «¿este navegador puede?», no «¿qué navegador es?».
 */

/** En qué estado está esto para quien está usando la app. */
export type EstadoDeLosAvisos =
  /** El navegador no puede: iPhone sin instalar, o un navegador viejo. */
  | 'no-disponible'
  /** El navegador puede, pero la academia todavia no cargo las claves VAPID. */
  | 'sin-configurar'
  /** Puede, y todavía no se le preguntó. */
  | 'sin-pedir'
  /** Dijo que sí y está suscripto. */
  | 'activos'
  /** Dijo que no. El navegador no deja volver a preguntar. */
  | 'bloqueados';

/** Si este navegador sabe hacer todo lo que hace falta. */
export function sePuede(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Cuánto se espera al service worker antes de darlo por no disponible.
 *
 * `navigator.serviceWorker.ready` **no se rechaza nunca**: si no hay ninguno
 * registrado, se queda esperando para siempre. Sin este tope, una pantalla que
 * depende de saber el estado se queda en blanco sin decir nada, que es
 * justamente lo que no puede pasar. Pasa de verdad: en desarrollo no hay
 * service worker, y en producción puede fallar el registro.
 */
const ESPERA_MAXIMA_MS = 3000;

/**
 * La clave publica de la academia, preguntada una sola vez.
 *
 * Tres respuestas distintas, y la diferencia importa:
 *  - una cadena: la academia tiene los avisos configurados;
 *  - `null`: la API contesto que NO hay clave cargada;
 *  - `undefined`: no se pudo preguntar (sin red, API caida). Eso no es lo mismo
 *    que «no esta configurado», y afirmarlo seria inventar.
 */
let clavePedida: Promise<string | null | undefined> | null = null;

async function clavePublica(): Promise<string | null | undefined> {
  clavePedida ??= llamarApi<{ clave: string | null }>('/push/clave-publica')
    .then((respuesta) => respuesta.clave)
    .catch(() => {
      // Se olvida el pedido fallido para que el proximo intento vuelva a
      // preguntar en vez de arrastrar para siempre un «no se pudo».
      clavePedida = null;
      return undefined;
    });
  return clavePedida;
}

/** El registro del service worker, o null si no aparece a tiempo. */
async function registro(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolver) => setTimeout(() => resolver(null), ESPERA_MAXIMA_MS)),
  ]);
}

/** En qué estado está, sin pedir nada ni cambiar nada. */
export async function estado(): Promise<EstadoDeLosAvisos> {
  if (!sePuede()) return 'no-disponible';

  // Se pregunta ANTES que nada por el permiso: no tiene sentido ofrecerle a
  // nadie algo que la academia todavia no puede mandar, y menos pedirle al
  // navegador un permiso que despues no se va a usar.
  if ((await clavePublica()) === null) return 'sin-configurar';

  if (Notification.permission === 'denied') return 'bloqueados';
  if (Notification.permission === 'default') return 'sin-pedir';

  // Permiso concedido no alcanza: puede haber dado permiso y después haberse
  // borrado la suscripción (datos del navegador limpiados, app reinstalada).
  const sw = await registro();
  if (!sw) return 'no-disponible';

  const suscripcion = await sw.pushManager.getSubscription();
  return suscripcion ? 'activos' : 'sin-pedir';
}

/**
 * Pide permiso, suscribe el navegador y lo registra en la API.
 *
 * Devuelve el estado en el que quedó. Sólo se debe llamar **desde un clic**: los
 * navegadores rechazan el pedido de permiso si no viene de algo que hizo la
 * persona, y Chrome directamente penaliza al sitio que pregunta al entrar.
 */
export async function activar(): Promise<EstadoDeLosAvisos> {
  if (!sePuede()) return 'no-disponible';

  // La clave PRIMERO, y despues el permiso. Al reves —como estaba— se le pedia
  // permiso al navegador para terminar diciendole que la academia no lo tiene
  // configurado: se gasta el unico pedido de permiso que Chrome permite hacer
  // con comodidad, y si la persona dice que no, recuperarlo exige que entre a
  // los ajustes del sitio.
  const clave = await clavePublica();
  if (clave === null) return 'sin-configurar';
  if (clave === undefined) {
    throw new Error('No pudimos comprobar si los avisos estan disponibles. Probá de nuevo.');
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueados' : 'sin-pedir';

  const sw = await registro();
  if (!sw) {
    throw new Error(
      'Esta app todavía no terminó de instalarse en el navegador. Cerrala y volvé a abrirla.',
    );
  }

  const suscripcion = await sw.pushManager.subscribe({
    // Obligatorio en todos los navegadores actuales: no se admite una
    // suscripción que pueda usarse sin mostrarle nada a la persona.
    userVisibleOnly: true,
    applicationServerKey: aBytes(clave),
  });

  const datos = suscripcion.toJSON();
  await llamarApi<void>('/push/suscripciones', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: suscripcion.endpoint,
      p256dh: datos.keys?.p256dh,
      auth: datos.keys?.auth,
      dispositivo: navigator.userAgent.slice(0, 120),
    }),
  });

  return 'activos';
}

/** Deja de recibir avisos en este navegador. */
export async function desactivar(): Promise<EstadoDeLosAvisos> {
  if (!sePuede()) return 'no-disponible';

  const sw = await registro();
  const suscripcion = await sw?.pushManager.getSubscription();
  if (!suscripcion) return 'sin-pedir';

  const { endpoint } = suscripcion;
  // Primero se da de baja en la API y después en el navegador. Al revés, si lo
  // segundo falla, la API seguiría mandando avisos a una dirección que ya no
  // existe: cada recordatorio sería un error.
  await llamarApi<void>('/push/suscripciones', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);
  await suscripcion.unsubscribe();

  return 'sin-pedir';
}

/**
 * Pasa la clave pública de texto a bytes, que es lo que pide `subscribe()`.
 *
 * La clave viene en base64url —con `-` y `_` en vez de `+` y `/`, y sin relleno—
 * porque es como viaja por HTTP. `atob` espera base64 común, así que hay que
 * deshacer las dos cosas.
 */
function aBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64);

  // Se escribe sobre un ArrayBuffer propio y no con `Uint8Array.from`: el tipo
  // de `applicationServerKey` no admite un buffer compartido, y `from` devuelve
  // un Uint8Array que podría estarlo.
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
