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

import { SupabaseAdminService } from '../src/common/supabase/supabase-admin.service';

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
    supabaseResponde(500, 'algo se rompió del otro lado');

    await expect(supabase.invitar('alumno@ejemplo.uy', 'https://app.ejemplo.uy')).rejects.toThrow(
      /\(500\)/,
    );
  });
});

describe('Al generar el enlace', () => {
  it('lee el action_link de la raíz, que es donde lo pone la API de Auth', async () => {
    // El cliente supabase-js lo anida bajo `properties`; la API cruda no. Leerlo
    // del lugar equivocado hacía fallar SIEMPRE el envío por WhatsApp.
    supabaseResponde(200, JSON.stringify({ action_link: 'https://proyecto.supabase.co/auth/v1/verify?token=abc' }));

    await expect(supabase.generarEnlace('alumno@ejemplo.uy', 'https://app.ejemplo.uy', true)).resolves.toMatch(
      /^https:\/\/proyecto\.supabase\.co\/auth\/v1\/verify/,
    );
  });

  it('también lo encuentra si alguna versión lo anida', async () => {
    supabaseResponde(200, JSON.stringify({ properties: { action_link: 'https://ejemplo.uy/anidado' } }));

    await expect(
      supabase.generarEnlace('alumno@ejemplo.uy', 'https://app.ejemplo.uy', true),
    ).resolves.toBe('https://ejemplo.uy/anidado');
  });

  it('una respuesta sin enlace no se hace pasar por buena', async () => {
    supabaseResponde(200, JSON.stringify({ user: { id: 'abc' } }));

    await expect(
      supabase.generarEnlace('alumno@ejemplo.uy', 'https://app.ejemplo.uy', true),
    ).rejects.toThrow(/no devolvió un enlace/);
  });
});
