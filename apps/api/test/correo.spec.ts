/**
 * Pruebas de lo que la API le dice a quien atiende cuando Supabase rechaza un
 * envío.
 *
 * No es cosmética: el mensaje es lo único que tiene la persona del mostrador
 * para saber qué hacer. Antes, cualquier 422 se traducía a «ya tiene cuenta», y
 * Supabase usa ese código para varias cosas. Invitar a un alumno de verdad
 * respondía que ya tenía cuenta —falso— y mandaba a buscar el problema donde no
 * estaba.
 */
import { ConfigService } from '@nestjs/config';

import {
  CuentaYaRegistradaError,
  SupabaseAdminService,
} from '../src/common/supabase/supabase-admin.service';

const config = {
  get: (clave: string) =>
    ({
      SUPABASE_URL: 'https://proyecto.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'clave-de-prueba-larga-para-pasar-el-minimo',
    })[clave],
} as unknown as ConfigService;

const supabase = new SupabaseAdminService(config);

const fetchOriginal = global.fetch;

/** Hace que Supabase conteste lo que diga la prueba. */
function supabaseResponde(estado: number, cuerpo: string) {
  global.fetch = (async () =>
    new Response(cuerpo, { status: estado })) as unknown as typeof global.fetch;
}

/** Corre algo que TIENE que fallar y devuelve el mensaje que le llega a quien atiende. */
async function mensajeDelFallo(intento: Promise<unknown>): Promise<string> {
  try {
    await intento;
  } catch (problema) {
    return (problema as Error).message;
  }
  throw new Error('Se esperaba un fallo y no lo hubo');
}

/** Hace que Supabase no conteste nunca y salte el corte por tiempo. */
function supabaseNoContesta() {
  global.fetch = (async () => {
    const problema = new Error('The operation was aborted due to timeout');
    problema.name = 'TimeoutError';
    throw problema;
  }) as unknown as typeof global.fetch;
}

afterEach(() => {
  global.fetch = fetchOriginal;
});

describe('Cuando Supabase rechaza una invitación', () => {
  it('el remitente de fábrica, que solo le escribe al equipo, se explica como tal', async () => {
    // Esto es lo que devuelve al invitar a alguien que no es del proyecto, y es
    // el caso más común al salir a producción.
    supabaseResponde(422, JSON.stringify({ msg: 'Email address not authorized' }));

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /solo le entrega a las cuentas del equipo/,
    );
  });

  it('una dirección ya registrada se explica como tal', async () => {
    supabaseResponde(422, JSON.stringify({ msg: 'A user with this email address has already been registered' }));

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /ya tiene cuenta/,
    );
  });

  it('los dos casos de 422 NO dan el mismo mensaje', async () => {
    // El corazón del arreglo: el código de estado no alcanza para distinguirlos.
    const mensajes: string[] = [];
    for (const cuerpo of [
      JSON.stringify({ msg: 'Email address not authorized' }),
      JSON.stringify({ msg: 'A user with this email address has already been registered' }),
    ]) {
      supabaseResponde(422, cuerpo);
      await supabase
        .invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')
        .catch((problema: Error) => mensajes.push(problema.message));
    }
    expect(mensajes).toHaveLength(2);
    expect(mensajes[0]).not.toBe(mensajes[1]);
  });

  it('el tope de correos dice cuál es el tope y cómo sacárselo de encima', async () => {
    supabaseResponde(429, JSON.stringify({ msg: 'email rate limit exceeded' }));

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /2 por hora/,
    );
  });

  it('un rechazo que no se reconoce dice el código, sin inventar una causa', async () => {
    supabaseResponde(400, 'algo raro que nadie vio antes');

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /\(400\)/,
    );
  });

  it('«ya registrada» se puede reconocer sin leer el texto', async () => {
    // De esto depende el enlace por WhatsApp: es el único fallo con salida, y
    // el reintento como acceso normal tiene que poder distinguirlo del resto.
    supabaseResponde(422, JSON.stringify({ msg: 'A user with this email address has already been registered' }));

    await expect(
      supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy'),
    ).rejects.toBeInstanceOf(CuentaYaRegistradaError);
  });
});

describe('Cuando Supabase no llega a mandar el correo', () => {
  // Esto pasó de verdad en la primera prueba con SMTP propio: el envío se colgó
  // y el mensaje decía «Supabase rechazó la invitación», que manda a revisar el
  // pedido —que estaba bien— en vez del servidor de correo.
  const tiempoAgotado = JSON.stringify({ msg: 'upstream request timeout' });

  it('un 504 no se llama «rechazo»: no hubo rechazo, no se completó', async () => {
    supabaseResponde(504, tiempoAgotado);

    const mensaje = await mensajeDelFallo(
      supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy'),
    );

    expect(mensaje).not.toMatch(/rechaz/i);
    expect(mensaje).toMatch(/504/);
  });

  it('manda a mirar el SMTP, que es lo único de afuera en este camino', async () => {
    supabaseResponde(504, tiempoAgotado);

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /SMTP/,
    );
  });

  it('avisa que la cuenta puede haber quedado creada igual', async () => {
    // Un corte a mitad de camino no dice si alcanzó a crearla. Callarlo lleva a
    // reintentar y recibir «ya tiene cuenta», que parece otro problema.
    supabaseResponde(504, tiempoAgotado);

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /puede haber quedado creada/,
    );
  });

  it('ofrece el camino que sí funciona mientras tanto', async () => {
    supabaseResponde(504, tiempoAgotado);

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /WhatsApp/,
    );
  });

  it('si no contesta nunca, corta y lo dice, en vez de dejar el panel girando', async () => {
    supabaseNoContesta();

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /no contestó en 60 segundos/,
    );
  });

  it('generar el código NO habla de SMTP: ese camino no manda ningún correo', async () => {
    // Mandar a revisar el servidor de correo cuando el correo no entra en juego
    // es exactamente el tipo de pista falsa que este arreglo viene a sacar.
    supabaseResponde(504, tiempoAgotado);

    const mensaje = await mensajeDelFallo(
      supabase.generarCodigo('alumno@ejemplo.uy', 'https://app.ejemplo.uy', true),
    );

    expect(mensaje).not.toMatch(/SMTP|WhatsApp/);
    expect(mensaje).toMatch(/504/);
  });
});

describe('Al generar el código de acceso', () => {
  it('lee el hashed_token de la raíz, que es donde lo pone la API de Auth', async () => {
    // El cliente supabase-js lo anida bajo `properties`; la API cruda no.
    supabaseResponde(200, JSON.stringify({ hashed_token: 'pkce_abc123', action_link: 'https://no-se-usa' }));

    await expect(
      supabase.generarCodigo('alumno@ejemplo.uy', 'https://app.ejemplo.uy', true),
    ).resolves.toEqual({ tokenHash: 'pkce_abc123', tipo: 'invite' });
  });

  it('también lo encuentra si alguna versión lo anida', async () => {
    supabaseResponde(200, JSON.stringify({ properties: { hashed_token: 'pkce_anidado' } }));

    await expect(
      supabase.generarCodigo('alumno@ejemplo.uy', 'https://app.ejemplo.uy', false),
    ).resolves.toEqual({ tokenHash: 'pkce_anidado', tipo: 'magiclink' });
  });

  it('NO devuelve la dirección de verificación de Supabase', async () => {
    // Esa dirección se consume con una sola visita, y WhatsApp visita los
    // enlaces para armar la vista previa: llegaba quemada. Si alguien la
    // volviera a usar, esta prueba lo delata.
    supabaseResponde(200, JSON.stringify({
      action_link: 'https://proyecto.supabase.co/auth/v1/verify?token=abc',
      hashed_token: 'pkce_abc123',
    }));

    const codigo = await supabase.generarCodigo('alumno@ejemplo.uy', 'https://app.ejemplo.uy', true);
    expect(JSON.stringify(codigo)).not.toMatch(/supabase\.co|auth\/v1\/verify/);
  });

  it('una respuesta sin código no se hace pasar por buena', async () => {
    supabaseResponde(200, JSON.stringify({ user: { id: 'abc' } }));

    await expect(
      supabase.generarCodigo('alumno@ejemplo.uy', 'https://app.ejemplo.uy', true),
    ).rejects.toThrow(/no devolvió un código/);
  });
});
