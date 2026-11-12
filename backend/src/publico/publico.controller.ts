import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PublicoService } from './publico.service.js';
import { CriarAgendamentoPublicoDto } from './dto/criar-agendamento-publico.dto.js';

@Controller('publico/:slug')
export class PublicoController {
  constructor(private readonly publicoService: PublicoService) {}

  @Get('servicos')
  listarServicos(@Param('slug') slug: string) {
    return this.publicoService.listarServicos(slug);
  }

  @Get('profissionais')
  listarProfissionais(@Param('slug') slug: string) {
    return this.publicoService.listarProfissionais(slug);
  }

  @Get('horarios')
  horarios(
    @Param('slug') slug: string,
    @Query('servicoIds') servicoIds: string,
    @Query('data') data: string,
    @Query('profissionalId') profissionalId?: string,
  ) {
    return this.publicoService.horariosDisponiveis(
      slug,
      servicoIds,
      data,
      profissionalId,
    );
  }

  @Post('agendamento')
  agendar(@Param('slug') slug: string, @Body() dto: CriarAgendamentoPublicoDto) {
    return this.publicoService.criarAgendamentoPublico(slug, dto);
  }
}
