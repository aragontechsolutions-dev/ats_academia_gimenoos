import { Module } from '@nestjs/common';
import { GraduadosController } from './graduados.controller';
import { GraduadosService } from './graduados.service';

@Module({
  controllers: [GraduadosController],
  providers: [GraduadosService],
})
export class GraduadosModule {}
