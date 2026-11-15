import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PublicoService } from './publico.service.js';
import { CriarAgendamentoPublicoDto } from './dto/criar-agendamento-publico.dto.js';

@Controller('publico/:slug')
export class PublicoController {
  constructor(private readonly publicoService: PublicoService) {}

  @Get()
  dados(@Param('slug') slug: string) {
    return this.publicoService.dadosPublicos(slug);
  }

  @Get('servicos')
  listarServicos(@Param('slug') slug: string) {
    return this.publicoService.listarServicos(slug);
  }

  @Get('profissionais')
  listarProfissionais(@Param('slug') slug: string) {
    return this.publicoService.listarProfissionais(slug);
  }

  /** Dias em que há atendimento, para o calendário (ex.: ?de=2026-12-01&dias=35). */
  @Get('dias')
  dias(
    @Param('slug') slug: string,
    @Query('de') de: string,
    @Query('dias') dias?: string,
    @Query('profissionalId') profissionalId?: string,
  ) {
    return this.publicoService.diasAbertos(slug, de, dias, profissionalId);
  }

  @Get('expediente')
  expediente(
    @Param('slug') slug: string,
    @Query('data') data: string,
    @Query('profissionalId') profissionalId?: string,
  ) {
    return this.publicoService.expediente(slug, data, profissionalId);
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
