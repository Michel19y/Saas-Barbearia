import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { PrismaService } from '../prisma/prisma.service.js';

@UseGuards(JwtAuthGuard)
@Controller('barbearia')
export class BarbeariaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('minha')
  async minha(@CurrentUser() user: JwtPayload) {
    const barbearia = await this.prisma.barbearia.findUnique({
      where: { id: user.barbeariaId },
      select: { nome: true, slug: true },
    });
    if (!barbearia) throw new NotFoundException('Barbearia não encontrada');
    return barbearia;
  }
}
