import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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

@Injectable()
export class AtendimentosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(barbeariaId: string) {
    return this.prisma.atendimento.findMany({
      where: { barbeariaId },
      include: { cliente: true, servico: true },
      orderBy: { data: 'desc' },
      take: 200,
    });
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
