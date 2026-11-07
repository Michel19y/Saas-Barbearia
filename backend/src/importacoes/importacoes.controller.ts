import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { ImportacoesService } from './importacoes.service.js';
import { ImportarPlanilhaDto } from './dto/importar-planilha.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('importacoes')
export class ImportacoesController {
  constructor(private readonly importacoesService: ImportacoesService) {}

  @Post('planilha')
  importar(@CurrentUser() user: JwtPayload, @Body() dto: ImportarPlanilhaDto) {
    return this.importacoesService.importarPlanilha(user.barbeariaId, user.sub, dto);
  }
}
