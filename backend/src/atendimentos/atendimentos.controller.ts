import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { PrismaService } from '../prisma/prisma.service.js';

@UseGuards(JwtAuthGuard)
@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.prisma.atendimento.findMany({
      where: { barbeariaId: user.barbeariaId },
      include: { cliente: true, servico: true },
      orderBy: { data: 'desc' },
      take: 200,
    });
  }
}
