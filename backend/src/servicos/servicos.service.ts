import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateServicoDto } from './dto/create-servico.dto.js';
import { UpdateServicoDto } from './dto/update-servico.dto.js';

@Injectable()
export class ServicosService {
  constructor(private readonly prisma: PrismaService) {}

  create(barbeariaId: string, dto: CreateServicoDto) {
    return this.prisma.servico.create({ data: { ...dto, barbeariaId } });
  }

  findAll(barbeariaId: string) {
    return this.prisma.servico.findMany({ where: { barbeariaId, ativo: true } });
  }

  async findOne(barbeariaId: string, id: string) {
    const servico = await this.prisma.servico.findUnique({ where: { id } });
    if (!servico) throw new NotFoundException('Serviço não encontrado');
    if (servico.barbeariaId !== barbeariaId) throw new ForbiddenException();
    return servico;
  }

  async update(barbeariaId: string, id: string, dto: UpdateServicoDto) {
    await this.findOne(barbeariaId, id);
    return this.prisma.servico.update({ where: { id }, data: dto });
  }

  async remove(barbeariaId: string, id: string) {
    await this.findOne(barbeariaId, id);
    return this.prisma.servico.update({ where: { id }, data: { ativo: false } });
  }
}
