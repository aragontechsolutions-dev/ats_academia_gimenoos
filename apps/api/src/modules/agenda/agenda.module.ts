import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { DisponibilidadService } from './disponibilidad.service';
import { ReservasService } from './reservas.service';

@Module({
  controllers: [AgendaController],
  providers: [DisponibilidadService, ReservasService],
  exports: [DisponibilidadService, ReservasService],
})
export class AgendaModule {}
