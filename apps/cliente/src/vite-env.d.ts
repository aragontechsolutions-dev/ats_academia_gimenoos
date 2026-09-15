/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Opcional: a dónde mandar a quien entra acá con una cuenta que no es de alumno. */
  readonly VITE_APP_INSTRUCTOR_URL?: string;
  readonly VITE_APP_PANEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
