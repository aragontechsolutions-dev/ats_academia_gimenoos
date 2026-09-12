import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para el navegador.
 *
 * Usa la clave anonima, que esta pensada para exponerse en el frontend: no
 * saltea las politicas de RLS. La clave service_role JAMAS debe llegar aca.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env y completalos.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
