import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MENSAGEM_SLUG_EM_USO,
  slugLivrePara,
  tratarSlugDuplicado,
} from '../common/slug-barbearia.js';
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
    const atual = await this.minha(barbeariaId);
    const { slug: novoSlug, ...dados } = dto;

    if (!novoSlug || novoSlug === atual.slug) {
      return this.prisma.barbearia.update({
        where: { id: barbeariaId },
        data: dados,
        select: CAMPOS,
      });
    }

    if (!(await slugLivrePara(this.prisma, novoSlug, barbeariaId))) {
      throw new ConflictException(MENSAGEM_SLUG_EM_USO);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Se a barbearia está voltando para um link que já foi dela, ele deixa de ser "antigo"
        await tx.slugAntigo.deleteMany({ where: { slug: novoSlug, barbeariaId } });
        // O link atual vira antigo: continua funcionando e fica reservado para esta barbearia
        await tx.slugAntigo.upsert({
          where: { slug: atual.slug },
          create: { slug: atual.slug, barbeariaId },
          update: {},
        });
        return tx.barbearia.update({
          where: { id: barbeariaId },
          data: { ...dados, slug: novoSlug },
          select: CAMPOS,
        });
      });
    } catch (erro) {
      return tratarSlugDuplicado(erro);
    }
  }
}
