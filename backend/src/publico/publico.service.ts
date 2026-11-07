import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CriarAgendamentoPublicoDto } from './dto/criar-agendamento-publico.dto.js';

const ABERTURA_HORA = 9;
const FECHAMENTO_HORA = 21;
const PASSO_MIN = 30;

@Injectable()
export class PublicoService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBarbeariaPorSlug(slug: string) {
    const barbearia = await this.prisma.barbearia.findUnique({ where: { slug } });
    if (!barbearia) throw new NotFoundException('Barbearia não encontrada');
    return barbearia;
  }

  async listarServicos(slug: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    return this.prisma.servico.findMany({
      where: { barbeariaId: barbearia.id, ativo: true },
      select: { id: true, nome: true, duracaoMin: true, precoCentavos: true },
      orderBy: { nome: 'asc' },
    });
  }

  async horariosDisponiveis(slug: string, servicoId: string, dataStr: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    const servico = await this.prisma.servico.findFirst({
      where: { id: servicoId, barbeariaId: barbearia.id, ativo: true },
    });
    if (!servico) throw new NotFoundException('Serviço não encontrado');

    const [ano, mes, dia] = dataStr.split('-').map(Number);
    if (!ano || !mes || !dia) throw new NotFoundException('Data inválida');

    const abertura = new Date(ano, mes - 1, dia, ABERTURA_HORA, 0, 0, 0);
    const fechamento = new Date(ano, mes - 1, dia, FECHAMENTO_HORA, 0, 0, 0);

    const agendamentosDoDia = await this.prisma.agendamento.findMany({
      where: {
        barbeariaId: barbearia.id,
        status: { notIn: ['CANCELADO'] },
        inicio: { lt: fechamento },
        fim: { gt: abertura },
      },
      select: { inicio: true, fim: true },
    });

    const horarios: string[] = [];
    for (
      let slot = new Date(abertura);
      slot < fechamento;
      slot = new Date(slot.getTime() + PASSO_MIN * 60000)
    ) {
      const fimSlot = new Date(slot.getTime() + servico.duracaoMin * 60000);
      if (fimSlot > fechamento) break;

      const conflita = agendamentosDoDia.some((a) => slot < a.fim && fimSlot > a.inicio);
      if (!conflita && slot.getTime() > Date.now()) {
        horarios.push(slot.toISOString());
      }
    }

    return horarios;
  }

  async criarAgendamentoPublico(slug: string, dto: CriarAgendamentoPublicoDto) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    const servico = await this.prisma.servico.findFirst({
      where: { id: dto.servicoId, barbeariaId: barbearia.id, ativo: true },
    });
    if (!servico) throw new NotFoundException('Serviço não encontrado');

    const profissional = await this.prisma.usuario.findFirst({
      where: { barbeariaId: barbearia.id, ativo: true },
      orderBy: { criadoEm: 'asc' },
    });
    if (!profissional) throw new NotFoundException('Barbearia sem profissional disponível');

    const inicio = new Date(dto.inicio);
    const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);

    const conflito = await this.prisma.agendamento.findFirst({
      where: {
        barbeariaId: barbearia.id,
        status: { notIn: ['CANCELADO'] },
        inicio: { lt: fim },
        fim: { gt: inicio },
      },
    });
    if (conflito) {
      throw new ConflictException('Esse horário acabou de ser ocupado, escolha outro');
    }

    const telefone = dto.telefone.replace(/\D/g, '');
    let cliente = await this.prisma.cliente.findFirst({
      where: { barbeariaId: barbearia.id, telefone },
    });
    if (!cliente) {
      cliente = await this.prisma.cliente.create({
        data: { barbeariaId: barbearia.id, nome: dto.nome, telefone },
      });
    }

    return this.prisma.agendamento.create({
      data: {
        barbeariaId: barbearia.id,
        clienteId: cliente.id,
        profissionalId: profissional.id,
        servicoId: servico.id,
        inicio,
        fim,
        status: 'PENDENTE',
      },
    });
  }
}
