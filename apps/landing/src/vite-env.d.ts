/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SITIO_URL?: string;
  /** Dominio del panel de administración. Ver src/lib/panel.ts. */
  readonly VITE_PANEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
