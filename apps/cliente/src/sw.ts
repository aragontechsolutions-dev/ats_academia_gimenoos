/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker de la PWA del alumno.
 *
 * Hoy solo precachea el "shell" de la aplicacion para que abra rapido y funcione
 * sin conexion. En la Etapa 3 se agregan aca los listeners 'push' y
 * 'notificationclick' para los recordatorios de clase.
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
