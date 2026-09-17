import { Global, Module } from '@nestjs/common';

import { PushService } from './push.service';

/** Global por el mismo motivo que Telegram: avisa quien tenga algo que avisar. */
@Global()
@Module({
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
