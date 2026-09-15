/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Dominio del sitio público. Se imprime en el pie del diploma. */
  readonly VITE_SITIO_URL?: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Opcionales: a dónde mandar a quien entra al panel sin ser de administración. */
  readonly VITE_APP_INSTRUCTOR_URL?: string;
  readonly VITE_APP_ALUMNO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
