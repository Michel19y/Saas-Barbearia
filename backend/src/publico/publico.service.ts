import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CriarAgendamentoPublicoDto } from './dto/criar-agendamento-publico.dto.js';

const ABERTURA_HORA = 9;
const FECHAMENTO_HORA = 21;
const PASSO_MIN = 30;

// Quem atende cliente. A recepção entra no sistema, mas não é agendável.
const PAPEIS_AGENDAVEIS = ['DONO', 'PROFISSIONAL'] as const;

@Injectable()
export class PublicoService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBarbeariaPorSlug(slug: string) {
    const barbearia = await this.prisma.barbearia.findUnique({ where: { slug } });
    if (!barbearia) throw new NotFoundException('Barbearia não encontrada');
    return barbearia;
  }

  private async getServicosOrdenados(barbeariaId: string, servicoIds: string[]) {
    if (servicoIds.length === 0) {
      throw new NotFoundException('Selecione pelo menos um serviço');
    }
    const servicos = await this.prisma.servico.findMany({
      where: { id: { in: servicoIds }, barbeariaId, ativo: true },
    });
    if (servicos.length !== new Set(servicoIds).size) {
      throw new NotFoundException('Um ou mais serviços não encontrados');
    }
    return servicoIds.map((id) => servicos.find((s) => s.id === id)!);
  }

  private getProfissionaisAgendaveis(barbeariaId: string) {
    return this.prisma.usuario.findMany({
      where: { barbeariaId, ativo: true, papel: { in: [...PAPEIS_AGENDAVEIS] } },
      select: { id: true, nome: true },
      orderBy: { criadoEm: 'asc' },
    });
  }

  async listarServicos(slug: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    return this.prisma.servico.findMany({
      where: { barbeariaId: barbearia.id, ativo: true },
      select: { id: true, nome: true, duracaoMin: true, precoCentavos: true },
      orderBy: { nome: 'asc' },
    });
  }

  async listarProfissionais(slug: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    return this.getProfissionaisAgendaveis(barbearia.id);
  }

  async horariosDisponiveis(
    slug: string,
    servicoIdsStr: string,
    dataStr: string,
    profissionalId?: string,
  ) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    const servicoIds = servicoIdsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const servicos = await this.getServicosOrdenados(barbearia.id, servicoIds);
    const duracaoTotal = servicos.reduce((soma, s) => soma + s.duracaoMin, 0);

    const [ano, mes, dia] = dataStr.split('-').map(Number);
    if (!ano || !mes || !dia) throw new NotFoundException('Data inválida');

    const profissionais = await this.getProfissionaisAgendaveis(barbearia.id);
    const candidatos = profissionalId
      ? profissionais.filter((p) => p.id === profissionalId)
      : profissionais;
    if (candidatos.length === 0) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const abertura = new Date(ano, mes - 1, dia, ABERTURA_HORA, 0, 0, 0);
    const fechamento = new Date(ano, mes - 1, dia, FECHAMENTO_HORA, 0, 0, 0);

    const agendamentosDoDia = await this.prisma.agendamento.findMany({
      where: {
        barbeariaId: barbearia.id,
        profissionalId: { in: candidatos.map((p) => p.id) },
        status: { notIn: ['CANCELADO'] },
        inicio: { lt: fechamento },
        fim: { gt: abertura },
      },
      select: { inicio: true, fim: true, profissionalId: true },
    });

    const horarios: string[] = [];
    for (
      let slot = new Date(abertura);
      slot < fechamento;
      slot = new Date(slot.getTime() + PASSO_MIN * 60000)
    ) {
      const fimSlot = new Date(slot.getTime() + duracaoTotal * 60000);
      if (fimSlot > fechamento) break;
      if (slot.getTime() <= Date.now()) continue;

      // O horário aparece se ao menos um dos profissionais candidatos está livre.
      const alguemLivre = candidatos.some((profissional) =>
        this.estaLivre(agendamentosDoDia, profissional.id, slot, fimSlot),
      );
      if (alguemLivre) horarios.push(slot.toISOString());
    }

    return horarios;
  }

  async criarAgendamentoPublico(slug: string, dto: CriarAgendamentoPublicoDto) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    const servicos = await this.getServicosOrdenados(barbearia.id, dto.servicoIds);
    const duracaoTotal = servicos.reduce((soma, s) => soma + s.duracaoMin, 0);

    const profissionais = await this.getProfissionaisAgendaveis(barbearia.id);
    const candidatos = dto.profissionalId
      ? profissionais.filter((p) => p.id === dto.profissionalId)
      : profissionais;
    if (candidatos.length === 0) {
      throw new NotFoundException(
        dto.profissionalId
          ? 'Profissional não encontrado'
          : 'Barbearia sem profissional disponível',
      );
    }

    const inicio = new Date(dto.inicio);
    const fimTotal = new Date(inicio.getTime() + duracaoTotal * 60000);

    const ocupados = await this.prisma.agendamento.findMany({
      where: {
        barbeariaId: barbearia.id,
        profissionalId: { in: candidatos.map((p) => p.id) },
        status: { notIn: ['CANCELADO'] },
        inicio: { lt: fimTotal },
        fim: { gt: inicio },
      },
      select: { inicio: true, fim: true, profissionalId: true },
    });

    const escolhido = candidatos.find((profissional) =>
      this.estaLivre(ocupados, profissional.id, inicio, fimTotal),
    );
    if (!escolhido) {
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

    const grupoId = servicos.length > 1 ? randomUUID() : null;
    const criados = [];
    let cursor = inicio;
    for (const servico of servicos) {
      const fimServico = new Date(cursor.getTime() + servico.duracaoMin * 60000);
      const agendamento = await this.prisma.agendamento.create({
        data: {
          barbeariaId: barbearia.id,
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          profissionalId: escolhido.id,
          servicoId: servico.id,
          inicio: cursor,
          fim: fimServico,
          status: 'PENDENTE',
          grupoId,
        },
        include: { servico: true, profissional: { select: { nome: true } } },
      });
      criados.push(agendamento);
      cursor = fimServico;
    }

    return criados;
  }

  private estaLivre(
    agendamentos: { inicio: Date; fim: Date; profissionalId: string }[],
    profissionalId: string,
    inicio: Date,
    fim: Date,
  ) {
    return !agendamentos.some(
      (a) =>
        a.profissionalId === profissionalId && inicio < a.fim && fim > a.inicio,
    );
  }
}
