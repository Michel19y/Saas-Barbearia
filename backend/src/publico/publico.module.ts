import { Module } from '@nestjs/common';
import { PublicoController } from './publico.controller.js';
import { PublicoService } from './publico.service.js';

@Module({
  controllers: [PublicoController],
  providers: [PublicoService],
})
export class PublicoModule {}
