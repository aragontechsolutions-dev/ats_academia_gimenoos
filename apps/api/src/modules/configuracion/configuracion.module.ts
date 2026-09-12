import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';

@Module({ controllers: [ConfiguracionController] })
export class ConfiguracionModule {}
