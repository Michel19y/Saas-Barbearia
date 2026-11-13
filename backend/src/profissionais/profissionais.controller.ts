import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { ProfissionaisService } from './profissionais.service.js';
import { CreateProfissionalDto } from './dto/create-profissional.dto.js';
import { UpdateProfissionalDto } from './dto/update-profissional.dto.js';

@ApiTags('profissionais')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profissionais')
export class ProfissionaisController {
  constructor(private readonly profissionaisService: ProfissionaisService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.profissionaisService.findAll(user.barbeariaId);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProfissionalDto) {
    if (user.papel !== 'DONO') {
      throw new ForbiddenException('Apenas o dono pode adicionar pessoas à equipe');
    }
    return this.profissionaisService.create(user.barbeariaId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProfissionalDto,
  ) {
    if (user.papel !== 'DONO') {
      throw new ForbiddenException('Apenas o dono pode editar a equipe');
    }
    return this.profissionaisService.update(user.barbeariaId, user.sub, id, dto);
  }
}
