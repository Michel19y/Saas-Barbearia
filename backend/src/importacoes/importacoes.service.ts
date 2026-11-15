import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleService } from '../google/google.service.js';
import { ImportarPlanilhaDto } from './dto/importar-planilha.dto.js';
import {
  type Aba,
  type AnalisePlanilha,
  type LinhaImportavel,
  analisarPlanilha,
  extrairSpreadsheetId,
} from './planilha-parser.js';
import { lerAbasDoArquivo } from './planilha-arquivo.js';

/** Duração dada aos serviços que a importação cria (a planilha não informa). */
const DURACAO_PADRAO_MIN = 30;
/** Quantas linhas de exemplo e de problema a prévia devolve (o total vem à parte). */
const LIMITE_AMOSTRA = 20;
const LIMITE_PROBLEMAS = 200;
/** Importações grandes (RNF05: 2.000 linhas) precisam de mais que os 5 s padrão da transação. */
const TEMPO_MAXIMO_TRANSACAO_MS = 60_000;

type Banco = Pick<PrismaService, 'cliente' | 'servico' | 'atendimento'>;

const unicos = (valores: string[]) => [...new Set(valores)];

@Injectable()
export class ImportacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleService,
  ) {}

  // ---------- leitura das abas ----------

  private abasDoGoogle(usuarioId: string, dto: ImportarPlanilhaDto): Promise<Aba[]> {
    return this.googleService.lerTodasAbas(usuarioId, extrairSpreadsheetId(dto.planilha));
  }

  // ---------- prévia (não grava nada) ----------

  async previaPlanilha(barbeariaId: string, usuarioId: string, dto: ImportarPlanilhaDto) {
    return this.previa(barbeariaId, await this.abasDoGoogle(usuarioId, dto));
  }

  async previaArquivo(barbeariaId: string, conteudo: Buffer, nomeArquivo: string) {
    return this.previa(barbeariaId, lerAbasDoArquivo(conteudo, nomeArquivo));
  }

  private async previa(barbeariaId: string, abas: Aba[]) {
    const analise = analisarPlanilha(abas);
    const nomesClientes = unicos(analise.linhas.map((l) => l.cliente));
    const nomesServicos = unicos(analise.linhas.map((l) => l.servico));
    const [clientes, servicos] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { barbeariaId, nome: { in: nomesClientes } },
        select: { nome: true },
      }),
      this.prisma.servico.findMany({
        where: { barbeariaId, nome: { in: nomesServicos } },
        select: { nome: true },
      }),
    ]);
    const existentesC = new Set(clientes.map((c) => c.nome));
    const existentesS = new Set(servicos.map((s) => s.nome));

    return {
      resumo: {
        atendimentos: analise.linhas.length,
        valorTotalCentavos: analise.linhas.reduce((soma, l) => soma + l.valorCentavos, 0),
        dias: analise.abas.filter((a) => a.importada).length,
        abasIgnoradas: analise.abas.filter((a) => !a.importada).length,
        clientesNovos: nomesClientes.filter((n) => !existentesC.has(n)).length,
        servicosNovos: nomesServicos.filter((n) => !existentesS.has(n)).length,
        problemas: analise.problemas.length,
      },
      abas: analise.abas,
      problemas: analise.problemas.slice(0, LIMITE_PROBLEMAS),
      amostra: analise.linhas.slice(0, LIMITE_AMOSTRA),
    };
  }

  // ---------- importação (grava) ----------

  /** Importa a partir de uma planilha do Google Sheets (precisa da conta Google conectada). */
  async importarPlanilha(barbeariaId: string, usuarioId: string, dto: ImportarPlanilhaDto) {
    return this.importar(barbeariaId, await this.abasDoGoogle(usuarioId, dto));
  }

  /** Importa a partir de um arquivo enviado (.xlsx, .xls, .ods ou .csv); não usa o Google. */
  async importarArquivo(barbeariaId: string, conteudo: Buffer, nomeArquivo: string) {
    return this.importar(barbeariaId, lerAbasDoArquivo(conteudo, nomeArquivo));
  }

  /**
   * Mesma análise da prévia; grava só as linhas sem problema. Tudo numa transação:
   * ou entra a planilha inteira, ou nada (sem importação pela metade).
   */
  private async importar(barbeariaId: string, abas: Aba[]) {
    const analise = analisarPlanilha(abas);
    const gravado = await this.prisma.$transaction(
      (tx) => this.gravar(tx, barbeariaId, analise.linhas),
      { timeout: TEMPO_MAXIMO_TRANSACAO_MS },
    );
    return { ...gravado, avisos: avisosDaImportacao(analise) };
  }

  private async gravar(tx: Banco, barbeariaId: string, linhas: LinhaImportavel[]) {
    if (linhas.length === 0) {
      return { clientesCriados: 0, servicosCriados: 0, atendimentosCriados: 0 };
    }
    const nomesClientes = unicos(linhas.map((l) => l.cliente));
    const nomesServicos = unicos(linhas.map((l) => l.servico));

    const [clientesExistentes, servicosExistentes] = await Promise.all([
      tx.cliente.findMany({
        where: { barbeariaId, nome: { in: nomesClientes } },
        select: { id: true, nome: true },
        orderBy: { criadoEm: 'asc' },
      }),
      tx.servico.findMany({
        where: { barbeariaId, nome: { in: nomesServicos } },
        select: { id: true, nome: true },
      }),
    ]);

    const clientesNovos = nomesClientes.filter((n) => !clientesExistentes.some((c) => c.nome === n));
    const servicosNovos = nomesServicos.filter((n) => !servicosExistentes.some((s) => s.nome === n));

    const [clientesCriados, servicosCriados] = await Promise.all([
      tx.cliente.createManyAndReturn({
        data: clientesNovos.map((nome) => ({ barbeariaId, nome })),
        select: { id: true, nome: true },
      }),
      tx.servico.createManyAndReturn({
        data: servicosNovos.map((nome) => ({
          barbeariaId,
          nome,
          duracaoMin: DURACAO_PADRAO_MIN,
          // Preço inicial do serviço novo: o valor da primeira vez que ele aparece na planilha
          precoCentavos: linhas.find((l) => l.servico === nome)?.valorCentavos ?? 0,
        })),
        select: { id: true, nome: true },
      }),
    ]);

    // Nomes repetidos no cadastro: fica o cliente mais antigo (primeiro da lista)
    const idCliente = new Map([...clientesCriados, ...clientesExistentes].reverse().map((c) => [c.nome, c.id]));
    const idServico = new Map([...servicosExistentes, ...servicosCriados].map((s) => [s.nome, s.id]));

    const { count } = await tx.atendimento.createMany({
      data: linhas.map((l) => ({
        barbeariaId,
        clienteId: idCliente.get(l.cliente),
        clienteNome: l.cliente,
        servicoId: idServico.get(l.servico) ?? '',
        data: l.dataHora,
        formaPagamento: l.formaPagamento,
        valorCentavos: l.valorCentavos,
        profissionalNome: l.profissional,
      })),
    });

    return {
      clientesCriados: clientesCriados.length,
      servicosCriados: servicosCriados.length,
      atendimentosCriados: count,
    };
  }
}

function avisosDaImportacao(analise: AnalisePlanilha): string[] {
  const problemas = analise.problemas.length;
  return [
    ...analise.abas
      .filter((a) => !a.importada)
      .map((a) => `Aba "${a.titulo}" ignorada: ${a.motivo}`),
    ...analise.abas.flatMap((a) => a.avisos.map((aviso) => `Aba "${a.titulo}": ${aviso}`)),
    ...(problemas > 0
      ? [`${problemas} linha(s) com problema não foram importadas (veja a lista na prévia)`]
      : []),
  ];
}
