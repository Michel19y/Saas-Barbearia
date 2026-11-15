import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { AgendamentosService } from './agendamentos.service.js';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto.js';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto.js';
import { EditarServicosDto } from './dto/editar-servicos.dto.js';

@ApiTags('agendamentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agendamentos')
export class AgendamentosController {
  constructor(private readonly agendamentosService: AgendamentosService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAgendamentoDto) {
    return this.agendamentosService.create(user.barbeariaId, user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.agendamentosService.findAll(user.barbeariaId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agendamentosService.findOne(user.barbeariaId, id);
  }

  /** Troca os serviços do atendimento (ex.: acrescentar sobrancelha na barba já marcada). */
  @Put(':id/servicos')
  editarServicos(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: EditarServicosDto) {
    return this.agendamentosService.editarServicos(user.barbeariaId, id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateAgendamentoDto) {
    return this.agendamentosService.update(user.barbeariaId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agendamentosService.remove(user.barbeariaId, id);
  }
}
