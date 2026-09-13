import { Module } from '@nestjs/common';
import { InstructoresController } from './instructores.controller';
import { InstructoresService } from './instructores.service';

@Module({
  controllers: [InstructoresController],
  providers: [InstructoresService],
})
export class InstructoresModule {}
