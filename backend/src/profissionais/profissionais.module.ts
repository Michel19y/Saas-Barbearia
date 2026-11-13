import { Module } from '@nestjs/common';
import { ProfissionaisController } from './profissionais.controller.js';
import { ProfissionaisService } from './profissionais.service.js';

@Module({
  controllers: [ProfissionaisController],
  providers: [ProfissionaisService],
})
export class ProfissionaisModule {}
