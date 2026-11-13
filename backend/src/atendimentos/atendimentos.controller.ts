import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { AtendimentosService } from './atendimentos.service.js';

@ApiTags('atendimentos')
@UseGuards(JwtAuthGuard)
@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentosService: AtendimentosService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.atendimentosService.findAll(user.barbeariaId);
  }

  @Get('resumo')
  @ApiQuery({ name: 'de', required: false, description: 'Início do período (ISO)' })
  @ApiQuery({ name: 'ate', required: false, description: 'Fim do período (ISO)' })
  resumo(
    @CurrentUser() user: JwtPayload,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.atendimentosService.resumo(user.barbeariaId, de, ate);
  }
}
