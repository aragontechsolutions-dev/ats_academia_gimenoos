import { z } from 'zod';

/**
 * Le saca las barras finales a una dirección.
 *
 * Existe porque una barra de más ya costó dos rondas de diagnóstico en
 * producción, y de las dos formas:
 *
 * - En **Supabase**, la lista de *Redirect URLs* se compara contra el destino
 *   que manda la API. Si acá quedó `https://app.com` y allá cargaron
 *   `https://app.com/`, no coinciden: Supabase descarta el destino en silencio
 *   y manda a la persona al Site URL, o sea a la app de otro rol.
 * - En el **correo**, las plantillas arman el enlace como
 *   `{{ .RedirectTo }}/entrar`. Con barra queda `//entrar`.
 *
 * No se puede normalizar lo que está cargado del lado de Supabase, pero sí lo
 * de este lado, que es la mitad que controlamos.
 */
const sinBarraFinal = (url: string): string => url.replace(/\/+$/, '');

/**
 * Validacion de variables de entorno.
 *
 * Se valida al arrancar (fail-fast): si falta una variable critica la API no
 * levanta, en lugar de fallar mas tarde con un 500 en produccion.
 *
 * Varias entradas además se **normalizan** acá, y no donde se usan: así hay un
 * solo lugar donde mirar qué forma tiene de verdad cada variable.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // --- Base de datos -------------------------------------------------------
  /** Pooler de Supabase (Supavisor, puerto 6543, transaction mode) + ?pgbouncer=true */
  DATABASE_URL: z.string().url(),
  /** Conexion directa (puerto 5432). Solo la usa `prisma migrate`. */
  DIRECT_URL: z.string().url(),

  // --- Supabase ------------------------------------------------------------
  /** Ej: https://xxxxxxxx.supabase.co */
  SUPABASE_URL: z.string().url(),
  /**
   * Clave service_role. Permite saltear RLS: vive SOLO en el backend.
   * Si aparece en cualquier bundle de frontend, hay que rotarla de inmediato.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /**
   * Secreto JWT heredado (HS256). Solo necesario si el proyecto Supabase todavia
   * no migro a claves asimetricas. Si esta vacio, se aceptan unicamente tokens
   * ES256 verificados contra el JWKS publico (recomendado).
   */
  SUPABASE_JWT_LEGACY_SECRET: z.string().optional(),

  /**
   * Puerta de arranque: la unica direccion que puede entrar sin invitacion, y lo
   * hace como ADMIN. Hace falta en la primera instalacion y al rehacer el
   * proyecto de Supabase, cuando todavia no hay nadie que pueda invitar.
   *
   * Conviene vaciarla despues del primer ingreso: mientras este puesta, quien
   * controle esa casilla de correo puede crearse un administrador.
   */
  ADMIN_INICIAL_EMAIL: z.string().email().optional().or(z.literal('')),

  // --- Direcciones de los frontends ----------------------------------------
  /** A donde cae un alumno al tocar el enlace de su invitacion. */
  APP_ALUMNO_URL: z.string().url().default('http://localhost:5175').transform(sinBarraFinal),
  /** A donde cae un administrador: el panel. */
  APP_PANEL_URL: z.string().url().default('http://localhost:5174').transform(sinBarraFinal),
  /** La PWA del instructor: su agenda del dia. */
  APP_INSTRUCTOR_URL: z.string().url().default('http://localhost:5176').transform(sinBarraFinal),

  // --- Seguridad HTTP ------------------------------------------------------
  /**
   * Origenes permitidos para CORS, separados por coma. Sin comodines.
   *
   * Se limpian acá y no en `main.ts` por el mismo motivo que las de arriba: un
   * origen con barra final **nunca** coincide. El navegador manda el encabezado
   * `Origin` como `https://app.com`, sin barra y sin ruta, y la comparación es
   * exacta. Con `https://app.com/` cargado, la app carga pero todas sus
   * llamadas a la API quedan bloqueadas, y el error se ve del lado del
   * navegador, no en los registros del servidor.
   */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5174,http://localhost:5175')
    .transform((valor) =>
      valor
        .split(',')
        .map((origen) => sinBarraFinal(origen.trim()))
        .filter(Boolean)
        .join(','),
    ),

  /** Limite de peticiones por ventana, por IP. */
  THROTTLE_TTL_SEGUNDOS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMITE: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;

export function validarEnv(config: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(config);

  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Variables de entorno invalidas o faltantes:\n${detalle}\n` +
        'Revisa apps/api/.env.example para el listado completo.',
    );
  }

  return resultado.data;
}
