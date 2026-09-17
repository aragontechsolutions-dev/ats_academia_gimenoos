/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker de la PWA del alumno.
 *
 * Hace dos cosas: precachea el "shell" de la aplicacion para que abra rapido y
 * funcione sin conexion, y recibe los recordatorios de clase.
 *
 * Nunca debe cachearse la respuesta de la API: contiene datos personales del
 * alumno y quedarian guardados en el dispositivo.
 */
precacheAndRoute(self.__WB_MANIFEST);

// Con registerType 'autoUpdate' la version nueva toma el control apenas se instala.
void self.skipWaiting();
self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

// --- Recordatorios de clase ------------------------------------------------

/** Lo que manda la API en cada aviso. */
interface AvisoRecibido {
  titulo: string;
  cuerpo: string;
  url: string;
}

/** Si llega algo con otra forma, se muestra esto en vez de "undefined". */
const POR_LAS_DUDAS: AvisoRecibido = {
  titulo: 'Academia Gimenoos',
  cuerpo: 'Tenes un aviso de la academia.',
  url: '/',
};

function leerAviso(evento: PushEvent): AvisoRecibido {
  try {
    const datos = evento.data?.json() as Partial<AvisoRecibido> | undefined;
    if (!datos?.titulo || !datos.cuerpo) return POR_LAS_DUDAS;
    return { titulo: datos.titulo, cuerpo: datos.cuerpo, url: datos.url ?? '/' };
  } catch {
    // Un aviso ilegible no puede dejar al navegador sin notificacion: varios
    // navegadores muestran uno generico y feo ("Este sitio se actualizo en
    // segundo plano") si el listener no muestra ninguna.
    return POR_LAS_DUDAS;
  }
}

self.addEventListener('push', (evento) => {
  const aviso = leerAviso(evento);

  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo,
      // TODO(datos-reales): cuando existan los iconos de la PWA, agregar aca
      // `icon` y `badge`. Hoy no se ponen a proposito: apuntar a un archivo que
      // no existe deja un hueco en la notificacion, y sin `icon` el navegador
      // usa el suyo, que se ve bien.

      // Etiqueta fija: si llegan el de 24 horas y el de 2 horas, el segundo
      // REEMPLAZA al primero en vez de apilarse. Dos avisos de la misma clase en
      // la pantalla es ruido. Al reemplazar no vuelve a vibrar ni a sonar, que
      // es el comportamiento por defecto y el que se quiere.
      tag: 'recordatorio-de-clase',
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data as { url?: string } | undefined)?.url ?? '/';

  evento.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Si la app ya esta abierta se la trae al frente en vez de abrir otra
      // pestania. Abrir una segunda copia de la misma app es lo que hace que
      // alguien termine con cuatro pestanias iguales sin entender por que.
      for (const ventana of abiertas) {
        if (new URL(ventana.url).origin === self.location.origin) {
          await ventana.focus();
          if ('navigate' in ventana) await ventana.navigate(destino).catch(() => undefined);
          return;
        }
      }

      await self.clients.openWindow(destino);
    })(),
  );
});
