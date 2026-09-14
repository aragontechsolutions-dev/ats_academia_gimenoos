/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker de la PWA del instructor.
 *
 * Hoy solo precachea el "shell" de la aplicacion para que abra rapido y funcione
 * sin conexion. En la Etapa 3 se agregan aca los listeners 'push' y
 * 'notificationclick' para avisarle de un cambio en su agenda.
 *
 * Nunca debe cachearse la respuesta de la API: trae datos personales de los
 * alumnos que el instructor tiene a cargo, y quedarian guardados en su telefono.
 */
precacheAndRoute(self.__WB_MANIFEST);

// Con registerType 'autoUpdate' la version nueva toma el control apenas se instala.
void self.skipWaiting();
self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});
