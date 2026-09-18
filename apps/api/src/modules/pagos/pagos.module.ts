import { Module } from '@nestjs/common';

import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { ComprobantesService } from './comprobantes.service';

@Module({
  controllers: [PagosController],
  providers: [PagosService, ComprobantesService],
})
export class PagosModule {}
