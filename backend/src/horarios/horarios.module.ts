import { Module } from '@nestjs/common';
import { HorariosController } from './horarios.controller.js';
import { HorariosService } from './horarios.service.js';

@Module({
  controllers: [HorariosController],
  providers: [HorariosService],
  // A página pública usa a mesma regra para oferecer e aceitar horários
  exports: [HorariosService],
})
export class HorariosModule {}
