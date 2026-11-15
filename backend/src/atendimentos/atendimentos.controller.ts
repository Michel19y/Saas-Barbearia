import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto.js';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { AtendimentosService } from './atendimentos.service.js';

function exigirDono(user: JwtPayload) {
  if (user.papel !== 'DONO') {
    throw new ForbiddenException('Apenas o dono pode corrigir o histórico de atendimentos');
  }
}

@ApiTags('atendimentos')
@UseGuards(JwtAuthGuard)
@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentosService: AtendimentosService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.atendimentosService.findAll(user.barbeariaId);
  }

  /** Atendimentos importados de planilha, no formato da lista de agendamentos. */
  @Get('historico')
  historico(@CurrentUser() user: JwtPayload) {
    return this.atendimentosService.historicoImportado(user.barbeariaId);
  }

  /** Corrige um atendimento importado. Só o dono, porque mexe no faturamento. */
  @Patch(':id')
  atualizar(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAtendimentoDto,
  ) {
    exigirDono(user);
    return this.atendimentosService.atualizarImportado(user.barbeariaId, id, dto);
  }

  /** Apaga um atendimento importado. Só o dono. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluir(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    exigirDono(user);
    await this.atendimentosService.excluirImportado(user.barbeariaId, id);
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
