import {
  BadRequestException,
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
      dto.clienteId
        ? this.prisma.cliente.findUnique({ where: { id: dto.clienteId } })
        : Promise.resolve(null),
      this.prisma.servico.findUnique({ where: { id: dto.servicoId } }),
    ]);
    if (dto.clienteId && (!cliente || cliente.barbeariaId !== barbeariaId)) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (!servico || servico.barbeariaId !== barbeariaId) {
      throw new NotFoundException('Serviço não encontrado');
    }
    const clienteNome = cliente?.nome ?? dto.clienteNome?.trim();
    if (!clienteNome) {
      throw new BadRequestException(
        'Selecione um cliente ou informe uma identificação para o atendimento',
      );
    }

    const inicio = new Date(dto.inicio);
    const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);

    await this.verificarConflito(profissionalId, inicio, fim);

    return this.prisma.agendamento.create({
      data: {
        barbeariaId,
        clienteId: cliente?.id ?? null,
        clienteNome,
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
    const existente = await this.prisma.agendamento.findUnique({
      where: { id },
      include: { atendimento: true },
    });
    if (!existente) throw new NotFoundException('Agendamento não encontrado');
    if (existente.barbeariaId !== barbeariaId) throw new ForbiddenException();

    const statusFinal = dto.status ?? existente.status;
    if (dto.formaPagamento && statusFinal !== 'CONCLUIDO') {
      throw new BadRequestException(
        'A forma de pagamento só pode ser informada ao concluir o atendimento',
      );
    }

    if (dto.outroFormaPagamento && dto.formaPagamento !== 'Outro') {
      throw new BadRequestException(
        'A descrição só pode ser informada para a forma de pagamento Outro',
      );
    }

    let formaPagamento: string | undefined = dto.formaPagamento;
    if (formaPagamento === 'Outro') {
      const descricao = dto.outroFormaPagamento?.trim();
      if (!descricao) {
        throw new BadRequestException(
          'Informe qual foi a forma de pagamento',
        );
      }
      formaPagamento = `Outro: ${descricao}`;
    } else if (dto.outroFormaPagamento) {
      throw new BadRequestException(
        'A descrição só pode ser informada para a forma de pagamento Outro',
      );
    }

    if (statusFinal === 'CONCLUIDO') {
      formaPagamento ??= existente.atendimento?.formaPagamento;
      if (!formaPagamento) {
        throw new BadRequestException(
          'Informe a forma de pagamento para concluir o atendimento',
        );
      }
    }

    const data: Record<string, unknown> = {
      servicoId: dto.servicoId,
      observacao: dto.observacao,
      status: dto.status,
    };

    if (dto.clienteId) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: dto.clienteId },
      });
      if (!cliente || cliente.barbeariaId !== barbeariaId) {
        throw new NotFoundException('Cliente não encontrado');
      }
      data.clienteId = cliente.id;
      data.clienteNome = cliente.nome;
    } else if (dto.clienteNome !== undefined) {
      const clienteNome = dto.clienteNome.trim();
      if (clienteNome.length < 2) {
        throw new BadRequestException(
          'Informe uma identificação com pelo menos 2 caracteres',
        );
      }
      data.clienteId = null;
      data.clienteNome = clienteNome;
    } else if (dto.clienteId === '') {
      throw new BadRequestException(
        'Selecione um cliente ou informe uma identificação para o atendimento',
      );
    }

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

    return this.prisma.$transaction(async (transaction) => {
      const atualizado = await transaction.agendamento.update({
        where: { id },
        data,
        include: {
          cliente: true,
          servico: true,
          profissional: { select: { nome: true } },
        },
      });

      if (atualizado.status === 'CONCLUIDO' && formaPagamento) {
        const dadosAtendimento = {
          clienteId: atualizado.clienteId,
          clienteNome: atualizado.clienteNome,
          servicoId: atualizado.servicoId,
          data: atualizado.inicio,
          formaPagamento,
          valorCentavos: atualizado.servico.precoCentavos,
          profissionalNome: atualizado.profissional.nome,
        };
        await transaction.atendimento.upsert({
          where: { agendamentoId: atualizado.id },
          create: {
            ...dadosAtendimento,
            agendamentoId: atualizado.id,
            barbeariaId,
          },
          update: dadosAtendimento,
        });
      }

      return atualizado;
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
