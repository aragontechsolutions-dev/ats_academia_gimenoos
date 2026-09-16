/**
 * La validación de variables de entorno.
 *
 * Estas pruebas existen por una razón concreta: **una barra de más ya costó dos
 * rondas de diagnóstico en producción**. Un instructor recibió su invitación y
 * el enlace lo dejó dentro de la app del alumno, porque el destino que mandaba
 * la API y la entrada cargada en Supabase diferían solo en esa barra.
 *
 * No se puede normalizar lo que está cargado del lado de Supabase, pero sí lo de
 * este lado. Estas pruebas fijan esa mitad.
 */
import { validarEnv } from '../src/config/env.validation';

/** Lo mínimo que el esquema exige para no fallar por otra cosa. */
const MINIMO = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:p@localhost:5432/db',
  SUPABASE_URL: 'https://ejemplo.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(40),
};

describe('Las direcciones de las apps se guardan sin barra final', () => {
  it('le saca la barra a las tres', () => {
    const env = validarEnv({
      ...MINIMO,
      APP_ALUMNO_URL: 'https://alumno.vercel.app/',
      APP_INSTRUCTOR_URL: 'https://instructor.vercel.app/',
      APP_PANEL_URL: 'https://panel.vercel.app/',
    });

    expect(env.APP_ALUMNO_URL).toBe('https://alumno.vercel.app');
    expect(env.APP_INSTRUCTOR_URL).toBe('https://instructor.vercel.app');
    expect(env.APP_PANEL_URL).toBe('https://panel.vercel.app');
  });

  it('aguanta más de una barra', () => {
    const env = validarEnv({ ...MINIMO, APP_INSTRUCTOR_URL: 'https://instructor.vercel.app///' });
    expect(env.APP_INSTRUCTOR_URL).toBe('https://instructor.vercel.app');
  });

  it('deja intacta la que ya estaba bien', () => {
    const env = validarEnv({ ...MINIMO, APP_INSTRUCTOR_URL: 'https://instructor.vercel.app' });
    expect(env.APP_INSTRUCTOR_URL).toBe('https://instructor.vercel.app');
  });

  it('sigue rechazando algo que no es una dirección', () => {
    // La normalización no puede ablandar la validación: una variable con un
    // valor sin sentido tiene que seguir impidiendo que la API levante.
    expect(() => validarEnv({ ...MINIMO, APP_INSTRUCTOR_URL: 'instructor.vercel.app' })).toThrow(
      /APP_INSTRUCTOR_URL/,
    );
  });
});

describe('Los orígenes de CORS se guardan limpios', () => {
  it('les saca la barra final', () => {
    // Con barra, el origen NUNCA coincide: el navegador manda `Origin` sin
    // barra y la comparación es exacta. La app carga y todas sus llamadas a la
    // API quedan bloqueadas, sin rastro en los registros del servidor.
    const env = validarEnv({
      ...MINIMO,
      CORS_ORIGINS: 'https://panel.vercel.app/,https://instructor.vercel.app/',
    });
    expect(env.CORS_ORIGINS).toBe('https://panel.vercel.app,https://instructor.vercel.app');
  });

  it('también les saca los espacios y descarta las entradas vacías', () => {
    const env = validarEnv({
      ...MINIMO,
      CORS_ORIGINS: ' https://panel.vercel.app , , https://alumno.vercel.app/ ',
    });
    expect(env.CORS_ORIGINS.split(',')).toEqual([
      'https://panel.vercel.app',
      'https://alumno.vercel.app',
    ]);
  });
});

describe('Lo que la validación ya hacía y no se rompió', () => {
  it('falla si falta una variable crítica, nombrándola', () => {
    expect(() => validarEnv({ ...MINIMO, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('el mensaje manda a mirar el .env.example', () => {
    expect(() => validarEnv({})).toThrow(/\.env\.example/);
  });
});
