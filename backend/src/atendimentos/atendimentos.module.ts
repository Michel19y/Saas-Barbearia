import { Module } from '@nestjs/common';
import { AtendimentosController } from './atendimentos.controller.js';
import { AtendimentosService } from './atendimentos.service.js';

@Module({
  controllers: [AtendimentosController],
  providers: [AtendimentosService],
})
export class AtendimentosModule {}
