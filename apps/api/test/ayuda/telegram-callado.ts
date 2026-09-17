import { ConfigService } from '@nestjs/config';

import { TelegramService } from '../../src/common/telegram/telegram.service';
import type { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * Un servicio de Telegram que no manda nada.
 *
 * Se construye sin token, que es exactamente el estado de una instalación que
 * todavía no configuró el bot: `avisar()` corta antes de tocar la red. Así las
 * pruebas de reservas y de la landing prueban lo suyo sin que un aviso salga a
 * internet ni haga falta simular `fetch` en cada una.
 *
 * Es el servicio de verdad y no un doble hecho a mano: si mañana cambia su
 * interfaz, esto deja de compilar en lugar de mentir.
 */
export function telegramCallado(): TelegramService {
  const sinToken = { get: () => undefined } as unknown as ConfigService;
  const prismaQueNoSeUsa = {
    avisosTelegram: { findUnique: async () => null, upsert: async () => ({}) },
  } as unknown as PrismaService;

  return new TelegramService(sinToken, prismaQueNoSeUsa);
}
