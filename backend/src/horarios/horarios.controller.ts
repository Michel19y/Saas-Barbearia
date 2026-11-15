import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { HorariosService } from './horarios.service.js';
import { AplicarMudancaDto, MudancaHorarioDto } from './dto/mudanca-horario.dto.js';

function exigirDono(user: JwtPayload) {
  if (user.papel !== 'DONO') {
    throw new ForbiddenException('Apenas o dono pode mudar os horários de funcionamento');
  }
}

/**
 * Horários de funcionamento. Fluxo da tela: simular (mostra quem seria cancelado),
 * depois aplicar com confirmação.
 */
@UseGuards(JwtAuthGuard)
@Controller('horarios')
export class HorariosController {
  constructor(private readonly horarios: HorariosService) {}

  @Get()
  obter(@CurrentUser() user: JwtPayload) {
    return this.horarios.obter(user.barbeariaId);
  }

  @Post('simular')
  simular(@CurrentUser() user: JwtPayload, @Body() dto: MudancaHorarioDto) {
    exigirDono(user);
    return this.horarios.simular(user.barbeariaId, dto);
  }

  @Post('aplicar')
  aplicar(@CurrentUser() user: JwtPayload, @Body() dto: AplicarMudancaDto) {
    exigirDono(user);
    const { confirmarCancelamento, ...mudanca } = dto;
    return this.horarios.aplicar(user.barbeariaId, mudanca, confirmarCancelamento === true);
  }
}
