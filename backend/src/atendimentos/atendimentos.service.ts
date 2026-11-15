import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Atendimento, Cliente, Servico } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto.js';

const MS_POR_MINUTO = 60_000;
const LIMITE_LISTAGEM = 200;
/** Separa os itens importados dos agendamentos reais na lista (os ids nunca colidem). */
export const PREFIXO_ID_IMPORTADO = 'importado:';

export type ResumoFinanceiro = {
  periodo: { de: string | null; ate: string | null };
  totalCentavos: number;
  quantidade: number;
  ticketMedioCentavos: number;
  porFormaPagamento: LinhaResumo[];
  porServico: LinhaResumo[];
  porProfissional: LinhaResumo[];
};

type LinhaResumo = {
  rotulo: string;
  quantidade: number;
  totalCentavos: number;
};

// A importação de planilha trouxe "Cartão Crédito" e o app grava "Cartão de crédito";
// sem normalizar, o resumo mostra a mesma forma de pagamento em duas linhas.
function normalizarFormaPagamento(valor: string) {
  const limpo = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+de\s+/g, ' ')
    .trim();

  if (limpo === 'pix') return 'Pix';
  if (limpo === 'dinheiro') return 'Dinheiro';
  if (limpo === 'cartao debito') return 'Cartão de débito';
  if (limpo === 'cartao credito') return 'Cartão de crédito';
  return valor.trim() || 'Não informado';
}

function somarPorRotulo(linhas: LinhaResumo[]) {
  const porRotulo = new Map<string, LinhaResumo>();
  for (const linha of linhas) {
    const atual = porRotulo.get(linha.rotulo);
    if (atual) {
      atual.quantidade += linha.quantidade;
      atual.totalCentavos += linha.totalCentavos;
    } else {
      porRotulo.set(linha.rotulo, { ...linha });
    }
  }
  return [...porRotulo.values()].sort(
    (a, b) => b.totalCentavos - a.totalCentavos,
  );
}

function lerData(valor: string | undefined, campo: string) {
  if (!valor) return undefined;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    throw new BadRequestException(`${campo} precisa ser uma data ISO válida`);
  }
  return data;
}

type AtendimentoCompleto = Atendimento & { cliente: Cliente | null; servico: Servico };

/**
 * Atendimento importado no formato da lista de agendamentos. O preço mostrado é o valor
 * realmente pago, não o preço atual do serviço; `importacao` traz os campos editáveis crus.
 */
function paraItemDaAgenda(a: AtendimentoCompleto) {
  return {
    id: `${PREFIXO_ID_IMPORTADO}${a.id}`,
    importado: true,
    importacao: {
      atendimentoId: a.id,
      profissionalNome: a.profissionalNome,
      formaPagamento: a.formaPagamento,
      valorCentavos: a.valorCentavos,
    },
    clienteId: a.clienteId,
    clienteNome: a.clienteNome,
    cliente: a.cliente,
    servicoId: a.servicoId,
    servico: { ...a.servico, precoCentavos: a.valorCentavos },
    inicio: a.data,
    fim: new Date(a.data.getTime() + a.servico.duracaoMin * MS_POR_MINUTO),
    status: 'CONCLUIDO' as const,
    observacao: [
      'Importado da planilha',
      a.profissionalNome && `Profissional: ${a.profissionalNome}`,
      a.formaPagamento,
    ]
      .filter(Boolean)
      .join(' · '),
    grupoId: null,
  };
}

/**
 * Cliente cadastrado (usa o nome do cadastro) ou só um nome, sem cadastro (clienteId null).
 * Sem nenhum dos dois no pedido, não mexe no cliente.
 */
function dadosDoCliente(dto: UpdateAtendimentoDto, nomeDoCadastro: string | undefined) {
  if (dto.clienteId) return { clienteId: dto.clienteId, clienteNome: nomeDoCadastro };
  if (dto.clienteId === null) {
    const nome = dto.clienteNome?.trim();
    if (!nome) throw new BadRequestException('Informe o nome do cliente');
    return { clienteId: null, clienteNome: nome };
  }
  return {};
}

@Injectable()
export class AtendimentosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(barbeariaId: string) {
    return this.prisma.atendimento.findMany({
      where: { barbeariaId },
      include: { cliente: true, servico: true },
      orderBy: { data: 'desc' },
      take: LIMITE_LISTAGEM,
    });
  }

  /**
   * Histórico importado (atendimentos que não vieram de um agendamento do sistema),
   * no mesmo formato da lista de agendamentos para aparecer na agenda.
   * O preço mostrado é o valor realmente pago naquele atendimento, não o preço atual do serviço.
   */
  async historicoImportado(barbeariaId: string) {
    const atendimentos = await this.prisma.atendimento.findMany({
      where: { barbeariaId, agendamentoId: null },
      include: { cliente: true, servico: true },
      orderBy: { data: 'asc' },
    });
    return atendimentos.map(paraItemDaAgenda);
  }

  /** Atendimento importado da barbearia; recusa os que vieram de um agendamento. */
  private async buscarImportado(barbeariaId: string, id: string) {
    const atendimento = await this.prisma.atendimento.findUnique({ where: { id } });
    if (!atendimento || atendimento.barbeariaId !== barbeariaId) {
      throw new NotFoundException('Atendimento não encontrado');
    }
    if (atendimento.agendamentoId) {
      throw new BadRequestException(
        'Esse atendimento veio de um agendamento; corrija pelo próprio agendamento',
      );
    }
    return atendimento;
  }

  /** Corrige um atendimento importado (reflete na agenda e no Financeiro). */
  async atualizarImportado(barbeariaId: string, id: string, dto: UpdateAtendimentoDto) {
    const atual = await this.buscarImportado(barbeariaId, id);
    const [cliente, servico] = await Promise.all([
      dto.clienteId ? this.prisma.cliente.findUnique({ where: { id: dto.clienteId } }) : null,
      dto.servicoId ? this.prisma.servico.findUnique({ where: { id: dto.servicoId } }) : null,
    ]);
    if (dto.clienteId && cliente?.barbeariaId !== barbeariaId) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (dto.servicoId && servico?.barbeariaId !== barbeariaId) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const atualizado = await this.prisma.atendimento.update({
      where: { id: atual.id },
      data: {
        ...dadosDoCliente(dto, cliente?.nome),
        servicoId: dto.servicoId,
        data: dto.data ? new Date(dto.data) : undefined,
        valorCentavos: dto.valorCentavos,
        formaPagamento: dto.formaPagamento?.trim(),
        profissionalNome: dto.profissionalNome === undefined ? undefined : dto.profissionalNome.trim() || null,
      },
      include: { cliente: true, servico: true },
    });
    return paraItemDaAgenda(atualizado);
  }

  /** Apaga um atendimento importado (ex.: linha errada ou importada em dobro). */
  async excluirImportado(barbeariaId: string, id: string) {
    const atual = await this.buscarImportado(barbeariaId, id);
    await this.prisma.atendimento.delete({ where: { id: atual.id } });
  }

  // O recorte do período vem pronto do cliente (já no fuso de quem está olhando),
  // para que "hoje" seja o hoje do dono da barbearia e não o do servidor.
  async resumo(
    barbeariaId: string,
    deIso?: string,
    ateIso?: string,
  ): Promise<ResumoFinanceiro> {
    const de = lerData(deIso, 'de');
    const ate = lerData(ateIso, 'ate');
    if (de && ate && de > ate) {
      throw new BadRequestException('O início do período é depois do fim');
    }

    const where = {
      barbeariaId,
      ...(de || ate
        ? { data: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } }
        : {}),
    };

    const [totais, porForma, porServico, porProfissional] = await Promise.all([
      this.prisma.atendimento.aggregate({
        where,
        _sum: { valorCentavos: true },
        _count: { _all: true },
      }),
      this.prisma.atendimento.groupBy({
        by: ['formaPagamento'],
        where,
        _sum: { valorCentavos: true },
        _count: { _all: true },
      }),
      this.prisma.atendimento.groupBy({
        by: ['servicoId'],
        where,
        _sum: { valorCentavos: true },
        _count: { _all: true },
      }),
      this.prisma.atendimento.groupBy({
        by: ['profissionalNome'],
        where,
        _sum: { valorCentavos: true },
        _count: { _all: true },
      }),
    ]);

    const servicos = await this.prisma.servico.findMany({
      where: { id: { in: porServico.map((linha) => linha.servicoId) } },
      select: { id: true, nome: true },
    });
    const nomePorServico = new Map(servicos.map((s) => [s.id, s.nome]));

    const totalCentavos = totais._sum.valorCentavos ?? 0;
    const quantidade = totais._count._all;

    return {
      periodo: { de: de?.toISOString() ?? null, ate: ate?.toISOString() ?? null },
      totalCentavos,
      quantidade,
      ticketMedioCentavos: quantidade
        ? Math.round(totalCentavos / quantidade)
        : 0,
      porFormaPagamento: somarPorRotulo(
        porForma.map((linha) => ({
          rotulo: normalizarFormaPagamento(linha.formaPagamento),
          quantidade: linha._count._all,
          totalCentavos: linha._sum.valorCentavos ?? 0,
        })),
      ),
      porServico: somarPorRotulo(
        porServico.map((linha) => ({
          rotulo: nomePorServico.get(linha.servicoId) ?? 'Serviço removido',
          quantidade: linha._count._all,
          totalCentavos: linha._sum.valorCentavos ?? 0,
        })),
      ),
      porProfissional: somarPorRotulo(
        porProfissional.map((linha) => ({
          rotulo: linha.profissionalNome?.trim() || 'Sem profissional',
          quantidade: linha._count._all,
          totalCentavos: linha._sum.valorCentavos ?? 0,
        })),
      ),
    };
  }
}
