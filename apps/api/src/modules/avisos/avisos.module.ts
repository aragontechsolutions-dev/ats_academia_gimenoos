import { Module } from '@nestjs/common';

import { AvisosController } from './avisos.controller';

@Module({ controllers: [AvisosController] })
export class AvisosModule {}
