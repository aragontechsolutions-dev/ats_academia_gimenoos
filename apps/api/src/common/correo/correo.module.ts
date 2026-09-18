import { Global, Module } from '@nestjs/common';

import { CorreoService } from './correo.service';

/** Global, por el mismo motivo que Telegram y el push: manda quien tenga algo que mandar. */
@Global()
@Module({
  providers: [CorreoService],
  exports: [CorreoService],
})
export class CorreoModule {}
