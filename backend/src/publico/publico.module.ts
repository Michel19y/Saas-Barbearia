import { Module } from '@nestjs/common';
import { PublicoController } from './publico.controller.js';
import { PublicoService } from './publico.service.js';
import { HorariosModule } from '../horarios/horarios.module.js';

@Module({
  imports: [HorariosModule],
  controllers: [PublicoController],
  providers: [PublicoService],
})
export class PublicoModule {}
