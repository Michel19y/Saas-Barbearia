import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateBarbeariaDto } from './dto/update-barbearia.dto.js';

const CAMPOS = { nome: true, slug: true, telefone: true, enderecoCidade: true } as const;

@Injectable()
export class BarbeariaService {
  constructor(private readonly prisma: PrismaService) {}

  async minha(barbeariaId: string) {
    const barbearia = await this.prisma.barbearia.findUnique({
      where: { id: barbeariaId },
      select: CAMPOS,
    });
    if (!barbearia) throw new NotFoundException('Barbearia não encontrada');
    return barbearia;
  }

  async atualizar(barbeariaId: string, dto: UpdateBarbeariaDto) {
    await this.minha(barbeariaId);
    return this.prisma.barbearia.update({
      where: { id: barbeariaId },
      data: dto,
      select: CAMPOS,
    });
  }
}
