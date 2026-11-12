import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProfissionalDto } from './dto/create-profissional.dto.js';

const CAMPOS = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
} as const;

@Injectable()
export class ProfissionaisService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(barbeariaId: string) {
    return this.prisma.usuario.findMany({
      where: { barbeariaId, ativo: true },
      select: CAMPOS,
      orderBy: { criadoEm: 'asc' },
    });
  }

  async create(barbeariaId: string, dto: CreateProfissionalDto) {
    const existente = await this.prisma.usuario.findFirst({
      where: { barbeariaId, email: dto.email },
    });
    if (existente) {
      throw new ConflictException('Já existe alguém com esse e-mail na equipe');
    }

    return this.prisma.usuario.create({
      data: {
        barbeariaId,
        nome: dto.nome,
        email: dto.email,
        senhaHash: await bcrypt.hash(dto.senha, 10),
        papel: 'PROFISSIONAL',
      },
      select: CAMPOS,
    });
  }
}
