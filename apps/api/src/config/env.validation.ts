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

  // --- Avisos por Telegram -------------------------------------------------
  /**
   * Token del bot, tal como lo entrega @BotFather.
   *
   * Es una credencial: quien lo tenga puede escribir como el bot y leer lo que
   * el bot recibe. Vive SOLO acá, en la variable de entorno, y a propósito no en
   * la base: así no viaja en los respaldos ni queda al alcance de un volcado.
   *
   * Es opcional. Sin token, los avisos no se mandan y la API arranca igual: el
   * sistema funcionaba antes de que esto existiera y tiene que seguir
   * funcionando si el bot se cae o todavía no se creó.
   *
   * La otra mitad —a qué conversación se escribe y qué se avisa— se configura
   * desde el panel, porque eso cambia con el tiempo y no es secreto.
   */
  TELEGRAM_BOT_TOKEN: z
    .string()
    .regex(
      /^\d+:[A-Za-z0-9_-]{30,}$/,
      'no tiene la forma de un token de BotFather (1234567890:AAE...)',
    )
    .optional()
    .or(z.literal('')),

  // --- Recordatorios de clase ----------------------------------------------
  /**
   * Secreto que tiene que presentar quien dispara los recordatorios.
   *
   * Los recordatorios no los lanza un temporizador interno sino una llamada de
   * afuera —hoy, un workflow de GitHub Actions—, porque en el plan gratuito de
   * Render el servicio se duerme y un temporizador dormido no dispara nada.
   *
   * Es opcional: sin esto el endpoint contesta 503 y nunca queda abierto. Tiene
   * que ser largo, porque es lo único que lo protege.
   */
  RECORDATORIOS_TOKEN: z
    .string()
    .min(32, 'tiene que tener al menos 32 caracteres: es lo único que protege el endpoint')
    .optional()
    .or(z.literal('')),

  // --- Avisos en el teléfono del alumno (Web Push) --------------------------
  /**
   * Claves VAPID: el par con el que la API firma cada aviso.
   *
   * La **pública** viaja al navegador y es pública de verdad: se sirve desde
   * `GET /push/clave-publica` en vez de copiarse a una variable del frontend,
   * para que no haya dos copias que puedan quedar desincronizadas.
   *
   * La **privada** es una credencial: quien la tenga puede mandarle
   * notificaciones a cualquiera que esté suscripto. Vive solo acá.
   *
   * Se generan una vez y no se cambian: **rotarlas invalida todas las
   * suscripciones**, y cada alumno tendría que volver a dar permiso.
   * Ver docs/25-avisos-en-el-telefono.md.
   */
  VAPID_PUBLIC_KEY: z.string().optional().or(z.literal('')),
  VAPID_PRIVATE_KEY: z.string().optional().or(z.literal('')),
  /**
   * Un contacto de quien manda los avisos, como pide el estándar. Sirve para que
   * el servicio del navegador sepa a quién escribirle si algo anda mal.
   */
  VAPID_SUBJECT: z
    .string()
    .regex(/^mailto:.+@.+\..+$/, 'tiene que ser un mailto: con una dirección de correo')
    .default('mailto:contacto@academiagimenoos.com.uy'),

  // --- Correo que manda la API por su cuenta --------------------------------
  /**
   * Servidor SMTP para los correos que NO son de autenticación.
   *
   * Los de invitación y los de ingreso los manda Supabase Auth, que solo sabe
   * mandar los suyos. Un recordatorio de clase no es ninguno de esos, así que
   * sale desde acá, contra el MISMO servidor que ya tiene configurado la
   * academia en Supabase (Brevo). Que sea el mismo importa: el dominio ya está
   * autenticado ahí y estos correos heredan esa reputación.
   *
   * Todo opcional: sin esto la API arranca igual y no manda correos.
   * La clave SMTP es una credencial y vive solo acá.
   */
  SMTP_HOST: z.string().optional().or(z.literal('')),
  SMTP_PUERTO: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().or(z.literal('')),
  SMTP_PASSWORD: z.string().optional().or(z.literal('')),
  /** Remitente, con nombre: `Academia Gimenoos <avisos@midominio.com>`. */
  SMTP_DESDE: z.string().default('Academia Gimenoos <no-responder@academiagimenoos.com.uy>'),
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
