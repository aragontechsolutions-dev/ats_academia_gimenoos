import { ConfigService } from '@nestjs/config';

import { TelegramService } from '../src/common/telegram/telegram.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

const TOKEN = '1234567890:AAEabcdefghijklmnopqrstuvwxyz012345678';

/** Un Prisma de mentira con sólo lo que este servicio toca. */
function prismaFalso(fila: Record<string, unknown> | null) {
  const upsert = jest.fn().mockResolvedValue({});
  return {
    prisma: {
      avisosTelegram: { findUnique: jest.fn().mockResolvedValue(fila), upsert },
    } as unknown as PrismaService,
    upsert,
  };
}

function servicio(token: string | null, fila: Record<string, unknown> | null) {
  const config = { get: () => token ?? undefined } as unknown as ConfigService;
  const { prisma, upsert } = prismaFalso(fila);
  return { telegram: new TelegramService(config, prisma), upsert };
}

/** Lo que Telegram contesta cuando todo salió bien. */
const OK = { ok: true, status: 200, json: async () => ({ ok: true, result: {} }) };

const AJUSTES_LISTOS = {
  chatId: '-100123',
  avisaReservaNueva: true,
  avisaClaseCerrada: true,
  avisaClaseCancelada: true,
  avisaClicWhatsapp: true,
};

describe('TelegramService', () => {
  let fetchFalso: jest.Mock;

  beforeEach(() => {
    fetchFalso = jest.fn().mockResolvedValue(OK);
    global.fetch = fetchFalso as unknown as typeof fetch;
    // El servicio avisa por `warn` cuando algo falla; en las pruebas sólo ensucia.
    jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('cuándo NO se manda nada', () => {
    it('sin token: la academia funcionaba antes de que esto existiera', async () => {
      const { telegram } = servicio(null, AJUSTES_LISTOS);
      expect(await telegram.avisar('reservaNueva', 'hola')).toEqual({ estado: 'omitido' });
      expect(fetchFalso).not.toHaveBeenCalled();
      expect(telegram.configurado).toBe(false);
    });

    it('sin conversación elegida', async () => {
      const { telegram } = servicio(TOKEN, { ...AJUSTES_LISTOS, chatId: null });
      await telegram.avisar('reservaNueva', 'hola');
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it('sin ninguna fila de configuración todavía', async () => {
      const { telegram } = servicio(TOKEN, null);
      await telegram.avisar('reservaNueva', 'hola');
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it('con ESE aviso apagado, aunque los otros estén prendidos', async () => {
      const { telegram } = servicio(TOKEN, { ...AJUSTES_LISTOS, avisaClicWhatsapp: false });
      expect(await telegram.avisar('clicWhatsapp', 'alguien tocó el botón')).toEqual({
        estado: 'omitido',
      });
      expect(fetchFalso).not.toHaveBeenCalled();

      // El interruptor apaga uno solo, no todos.
      await telegram.avisar('reservaNueva', 'clase nueva');
      expect(fetchFalso).toHaveBeenCalledTimes(1);
    });
  });

  describe('cuando sí se manda', () => {
    it('le pega al bot correcto y manda el texto', async () => {
      const { telegram } = servicio(TOKEN, AJUSTES_LISTOS);
      expect(await telegram.avisar('reservaNueva', '<b>Nueva clase</b>')).toEqual({
        estado: 'enviado',
      });

      const [url, opciones] = fetchFalso.mock.calls[0];
      expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
      const cuerpo = JSON.parse(opciones.body);
      expect(cuerpo.chat_id).toBe('-100123');
      expect(cuerpo.text).toBe('<b>Nueva clase</b>');
      expect(cuerpo.parse_mode).toBe('HTML');
    });

    it('deja anotado el envío y limpia el fallo anterior', async () => {
      const { telegram, upsert } = servicio(TOKEN, AJUSTES_LISTOS);
      await telegram.avisar('reservaNueva', 'hola');
      expect(upsert.mock.calls[0][0].update).toMatchObject({
        ultimoError: null,
        ultimoErrorAt: null,
      });
    });
  });

  describe('cuando Telegram falla', () => {
    it('NO propaga el error: la clase ya se guardó', async () => {
      fetchFalso.mockResolvedValue({
        ok: true,
        status: 400,
        json: async () => ({ ok: false, description: 'chat not found' }),
      });
      const { telegram } = servicio(TOKEN, AJUSTES_LISTOS);
      // No lanza, y además dice qué pasó: eso es lo que usan los recordatorios
      // para decidir si anotarlo como fallido o reintentarlo más adelante.
      await expect(telegram.avisar('reservaNueva', 'hola')).resolves.toEqual({
        estado: 'fallo',
        motivo: 'chat not found',
      });
    });

    it('guarda el motivo que dio Telegram, no uno inventado', async () => {
      fetchFalso.mockResolvedValue({
        ok: true,
        status: 403,
        json: async () => ({ ok: false, description: 'bot was blocked by the user' }),
      });
      const { telegram, upsert } = servicio(TOKEN, AJUSTES_LISTOS);
      await telegram.avisar('reservaNueva', 'hola');
      expect(upsert.mock.calls[0][0].update.ultimoError).toBe('bot was blocked by the user');
    });

    it('tampoco propaga si la red se cae', async () => {
      fetchFalso.mockRejectedValue(new Error('ECONNREFUSED'));
      const { telegram } = servicio(TOKEN, AJUSTES_LISTOS);
      const resultado = await telegram.avisar('claseCerrada', 'hola');
      expect(resultado.estado).toBe('fallo');
    });

    it('el botón «probar» SÍ falla: quien lo apretó está esperando el motivo', async () => {
      fetchFalso.mockResolvedValue({
        ok: true,
        status: 400,
        json: async () => ({ ok: false, description: 'chat not found' }),
      });
      const { telegram } = servicio(TOKEN, AJUSTES_LISTOS);
      await expect(telegram.probar('-100123')).rejects.toThrow('chat not found');
    });

    it('probar sin bot explica qué falta', async () => {
      const { telegram } = servicio(null, AJUSTES_LISTOS);
      await expect(telegram.probar('-100123')).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
    });
  });

  describe('descubrir conversaciones', () => {
    it('junta las repetidas en una sola', async () => {
      fetchFalso.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: [
            { message: { chat: { id: 111, type: 'private', first_name: 'Henry', last_name: 'Gimeno' } } },
            { message: { chat: { id: 111, type: 'private', first_name: 'Henry', last_name: 'Gimeno' } } },
            { message: { chat: { id: -100222, type: 'supergroup', title: 'Avisos Academia' } } },
          ],
        }),
      });
      const { telegram } = servicio(TOKEN, AJUSTES_LISTOS);

      expect(await telegram.chatsDisponibles()).toEqual([
        { id: '111', nombre: 'Henry Gimeno', tipo: 'privado' },
        { id: '-100222', nombre: 'Avisos Academia', tipo: 'grupo' },
      ]);
    });

    it('un grupo con id negativo enorme se conserva como texto', async () => {
      // Pasado a número, Telegram redondearía en silencio y los avisos irían a
      // ninguna parte.
      fetchFalso.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: [{ message: { chat: { id: -1002233445566, type: 'supergroup', title: 'Grupo' } } }],
        }),
      });
      const { telegram } = servicio(TOKEN, AJUSTES_LISTOS);
      const [chat] = await telegram.chatsDisponibles();
      expect(chat!.id).toBe('-1002233445566');
      expect(typeof chat!.id).toBe('string');
    });

    it('una novedad sin chat no rompe la lista', async () => {
      fetchFalso.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: [{}, { edited_message: {} }] }),
      });
      const { telegram } = servicio(TOKEN, AJUSTES_LISTOS);
      expect(await telegram.chatsDisponibles()).toEqual([]);
    });
  });
});
