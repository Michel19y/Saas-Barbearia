import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto.js';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto.js';

@Injectable()
export class AgendamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(barbeariaId: string, profissionalId: string, dto: CreateAgendamentoDto) {
    const [cliente, servico] = await Promise.all([
      this.prisma.cliente.findUnique({ where: { id: dto.clienteId } }),
      this.prisma.servico.findUnique({ where: { id: dto.servicoId } }),
    ]);
    if (!cliente || cliente.barbeariaId !== barbeariaId) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (!servico || servico.barbeariaId !== barbeariaId) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const inicio = new Date(dto.inicio);
    const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);

    await this.verificarConflito(profissionalId, inicio, fim);

    return this.prisma.agendamento.create({
      data: {
        barbeariaId,
        clienteId: dto.clienteId,
        servicoId: dto.servicoId,
        profissionalId,
        inicio,
        fim,
        observacao: dto.observacao,
      },
      include: { cliente: true, servico: true },
    });
  }

  findAll(barbeariaId: string) {
    return this.prisma.agendamento.findMany({
      where: { barbeariaId },
      include: { cliente: true, servico: true },
      orderBy: { inicio: 'asc' },
    });
  }

  async findOne(barbeariaId: string, id: string) {
    const agendamento = await this.prisma.agendamento.findUnique({ where: { id } });
    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');
    if (agendamento.barbeariaId !== barbeariaId) throw new ForbiddenException();
    return agendamento;
  }

  async update(barbeariaId: string, id: string, dto: UpdateAgendamentoDto) {
    const existente = await this.findOne(barbeariaId, id);

    const data: Record<string, unknown> = {
      clienteId: dto.clienteId,
      servicoId: dto.servicoId,
      observacao: dto.observacao,
      status: dto.status,
    };

    if (dto.inicio || dto.servicoId) {
      const servicoId = dto.servicoId ?? existente.servicoId;
      const servico = await this.prisma.servico.findUnique({ where: { id: servicoId } });
      if (!servico || servico.barbeariaId !== barbeariaId) {
        throw new NotFoundException('Serviço não encontrado');
      }
      const inicio = dto.inicio ? new Date(dto.inicio) : existente.inicio;
      const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);
      await this.verificarConflito(existente.profissionalId, inicio, fim, id);
      data.inicio = inicio;
      data.fim = fim;
    }

    return this.prisma.agendamento.update({
      where: { id },
      data,
      include: { cliente: true, servico: true },
    });
  }

  async remove(barbeariaId: string, id: string) {
    await this.findOne(barbeariaId, id);
    return this.prisma.agendamento.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });
  }

  private async verificarConflito(
    profissionalId: string,
    inicio: Date,
    fim: Date,
    ignorarId?: string,
  ) {
    const conflito = await this.prisma.agendamento.findFirst({
      where: {
        id: ignorarId ? { not: ignorarId } : undefined,
        profissionalId,
        status: { notIn: ['CANCELADO'] },
        inicio: { lt: fim },
        fim: { gt: inicio },
      },
    });
    if (conflito) {
      throw new ConflictException('Já existe um agendamento nesse horário');
    }
  }
}
