import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';

import { PushService } from '../src/common/push/push.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Claves de mentira, solo para estas pruebas.
 *
 * No son un par valido y no hace falta que lo sean: `setVapidDetails` y
 * `sendNotification` estan simulados. Estan escritas con la forma correcta para
 * que se lea como lo que seria en produccion. La publica, ademas, es publica por
 * definicion: viaja al navegador en cada suscripcion.
 */
const CLAVES = {
  VAPID_PUBLIC_KEY: 'BNF6QHK3TT7ROks1n6LUNd1JYTdfp9E-l0LpgXJrHLkdzYtqvizJXwmRLORB-gqehycZQsdbkRUQLoXw5JfXuSw',
  VAPID_PRIVATE_KEY: 'sF9Hn1qKzQ1rPmXk3vYbEwJ7tLgR2sNcU8dZaWfMhQo',
  VAPID_SUBJECT: 'mailto:contacto@academiagimenoos.com.uy',
};

const AVISO = { titulo: 'Tenés clase mañana', cuerpo: 'A las 14:00.', url: '/' };

function armar(claves: Record<string, string>, suscripciones: Array<Record<string, unknown>>) {
  const borrados: string[] = [];
  const prisma = {
    suscripcionPush: {
      findMany: jest.fn().mockResolvedValue(suscripciones),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        borrados.push(where.id);
        return Promise.resolve({});
      }),
      updateMany: jest.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;

  const config = { get: (k: string) => claves[k], getOrThrow: (k: string) => claves[k] } as unknown as ConfigService;
  return { push: new PushService(config, prisma), borrados, prisma };
}

const suscripcion = (id: string, endpoint = `https://fcm.googleapis.com/fcm/send/${id}`) => ({
  id,
  endpoint,
  p256dh: 'clave-de-prueba',
  auth: 'secreto',
});

describe('PushService', () => {
  let mandar: jest.SpyInstance;

  beforeEach(() => {
    mandar = jest.spyOn(webpush, 'sendNotification').mockResolvedValue({} as never);
    jest.spyOn(webpush, 'setVapidDetails').mockImplementation(() => undefined);
    jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(require('@nestjs/common').Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('cuándo NO se manda nada', () => {
    it('sin claves configuradas', async () => {
      const { push } = armar({}, [suscripcion('a')]);
      expect(await push.avisar('u1', AVISO)).toEqual({ estado: 'omitido' });
      expect(mandar).not.toHaveBeenCalled();
      expect(push.clavePublica).toBeNull();
    });

    it('con claves pero sin ningún navegador suscripto', async () => {
      const { push } = armar(CLAVES, []);
      expect(await push.avisar('u1', AVISO)).toEqual({ estado: 'omitido' });
      expect(mandar).not.toHaveBeenCalled();
    });
  });

  describe('cuando sí se manda', () => {
    it('le llega a TODOS los dispositivos de la persona', async () => {
      // A todos y no a uno: no hay forma de saber cuál está mirando.
      const { push } = armar(CLAVES, [suscripcion('a'), suscripcion('b'), suscripcion('c')]);
      expect(await push.avisar('u1', AVISO)).toEqual({ estado: 'enviado', dispositivos: 3 });
      expect(mandar).toHaveBeenCalledTimes(3);
    });

    it('manda el aviso como JSON, con lo que el service worker espera', async () => {
      const { push } = armar(CLAVES, [suscripcion('a')]);
      await push.avisar('u1', AVISO);
      expect(JSON.parse(mandar.mock.calls[0][1] as string)).toEqual(AVISO);
    });

    it('le pone un vencimiento: un recordatorio que llega tarde no sirve', async () => {
      const { push } = armar(CLAVES, [suscripcion('a')]);
      await push.avisar('u1', AVISO);
      expect((mandar.mock.calls[0][2] as { TTL: number }).TTL).toBe(4 * 60 * 60);
    });

    it('alcanza con que llegue a uno: una suscripción vencida no arruina el aviso', async () => {
      const { push } = armar(CLAVES, [suscripcion('viejo'), suscripcion('nuevo')]);
      mandar.mockRejectedValueOnce(new WebPushError('gone', 410, {}, '', ''));

      expect(await push.avisar('u1', AVISO)).toEqual({ estado: 'enviado', dispositivos: 1 });
    });
  });

  describe('suscripciones que ya no sirven', () => {
    it.each([404, 410])('se borran cuando el servicio contesta %i', async (codigo) => {
      // Si no se borraran, la tabla se llena de direcciones muertas y cada
      // recordatorio se convierte en una ronda de errores inútiles.
      const { push, borrados } = armar(CLAVES, [suscripcion('muerta')]);
      mandar.mockRejectedValue(new WebPushError('gone', codigo, {}, '', ''));

      const resultado = await push.avisar('u1', AVISO);
      expect(borrados).toEqual(['muerta']);
      expect(resultado.estado).toBe('fallo');
    });

    it('un error pasajero NO borra la suscripción', async () => {
      // Un 500 del servicio del fabricante puede ser un rato nomás; borrar por
      // eso perdería una suscripción que sirve.
      const { push, borrados } = armar(CLAVES, [suscripcion('buena')]);
      mandar.mockRejectedValue(new WebPushError('server error', 500, {}, 'ups', ''));

      expect((await push.avisar('u1', AVISO)).estado).toBe('fallo');
      expect(borrados).toEqual([]);
    });

    it('tampoco la borra un corte de red', async () => {
      const { push, borrados } = armar(CLAVES, [suscripcion('buena')]);
      mandar.mockRejectedValue(new Error('ECONNREFUSED'));

      expect((await push.avisar('u1', AVISO)).estado).toBe('fallo');
      expect(borrados).toEqual([]);
    });
  });

  describe('lo que se registra', () => {
    it('NO deja la dirección de la suscripción en el registro', async () => {
      // La dirección es una credencial: quien la tenga puede mandarle avisos a
      // esa persona. En los registros va solo el dominio del servicio.
      const warn = jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn');
      const { push } = armar(CLAVES, [
        suscripcion('x', 'https://fcm.googleapis.com/fcm/send/SECRETO-QUE-NO-DEBE-APARECER'),
      ]);
      mandar.mockRejectedValue(new WebPushError('server error', 500, {}, 'ups', ''));

      await push.avisar('u1', AVISO);

      const registrado = warn.mock.calls.flat().join(' ');
      expect(registrado).not.toContain('SECRETO-QUE-NO-DEBE-APARECER');
      expect(registrado).toContain('fcm.googleapis.com');
    });
  });
});
