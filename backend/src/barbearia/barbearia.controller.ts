import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { BarbeariaService } from './barbearia.service.js';
import { UpdateBarbeariaDto } from './dto/update-barbearia.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('barbearia')
export class BarbeariaController {
  constructor(private readonly barbeariaService: BarbeariaService) {}

  @Get('minha')
  minha(@CurrentUser() user: JwtPayload) {
    return this.barbeariaService.minha(user.barbeariaId);
  }

  @Patch('minha')
  atualizar(@CurrentUser() user: JwtPayload, @Body() dto: UpdateBarbeariaDto) {
    if (user.papel !== 'DONO') {
      throw new ForbiddenException('Apenas o dono pode editar a barbearia');
    }
    return this.barbeariaService.atualizar(user.barbeariaId, dto);
  }
}
