import { Module } from '@nestjs/common';
import { AtendimentosController } from './atendimentos.controller.js';

@Module({
  controllers: [AtendimentosController],
})
export class AtendimentosModule {}
