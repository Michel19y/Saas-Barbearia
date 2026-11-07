import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { AgendamentosService } from './agendamentos.service.js';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto.js';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto.js';

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

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateAgendamentoDto) {
    return this.agendamentosService.update(user.barbeariaId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agendamentosService.remove(user.barbeariaId, id);
  }
}
