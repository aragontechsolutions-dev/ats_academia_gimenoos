import { Global, Module } from '@nestjs/common';

import { TelegramService } from './telegram.service';

/**
 * Global porque avisa cualquiera: la agenda cuando se reserva, el instructor
 * cuando cierra una clase, la landing cuando alguien toca WhatsApp. Declararlo
 * en cada módulo sería repetir el mismo import cinco veces.
 */
@Global()
@Module({
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
