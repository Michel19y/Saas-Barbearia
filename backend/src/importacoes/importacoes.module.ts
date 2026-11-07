import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module.js';
import { ImportacoesController } from './importacoes.controller.js';
import { ImportacoesService } from './importacoes.service.js';

@Module({
  imports: [GoogleModule],
  controllers: [ImportacoesController],
  providers: [ImportacoesService],
})
export class ImportacoesModule {}
