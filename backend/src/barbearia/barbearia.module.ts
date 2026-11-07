import { Module } from '@nestjs/common';
import { BarbeariaController } from './barbearia.controller.js';

@Module({
  controllers: [BarbeariaController],
})
export class BarbeariaModule {}
