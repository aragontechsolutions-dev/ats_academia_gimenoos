import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest (y no generateSW) porque el service worker es propio, igual
      // que en la app del alumno. En la Etapa 3 ese archivo suma los listeners de
      // 'push' para avisarle al instructor de un cambio en su agenda.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Gimenoos Instructores',
        short_name: 'Gimenoos Inst.',
        description: 'Tu agenda, el contacto con el alumno y el cierre de cada clase.',
        lang: 'es-UY',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        // El negro de la barra de la app, no el rojo de la marca: este color pinta
        // la barra de estado del teléfono, que queda pegada al encabezado.
        theme_color: '#0b0b0d',
        // TODO(datos-reales): reemplazar por los iconos con el logo de la academia.
        // Hacen falta 192x192, 512x512 y una version "maskable" de 512x512.
        icons: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5176 },
});
