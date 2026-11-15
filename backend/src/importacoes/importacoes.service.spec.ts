import { Test, type TestingModule } from '@nestjs/testing';
import { GoogleService } from '../google/google.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImportacoesService } from './importacoes.service.js';
import type { Aba } from './planilha-parser.js';

const BARBEARIA = 'b1';
const CABECALHO = ['HORARIO', 'TIPO DO SERVIÇO', 'CLIENTE', 'ENTRADA', 'FP'];
/** Ana atende João (cliente já cadastrado) e Pedro (novo); a linha 5 tem valor ilegível. */
const ABAS: Aba[] = [
  {
    titulo: '10-11-2026',
    linhas: [
      ['Ana'],
      CABECALHO,
      ['09:00', 'Corte', 'João', '45,00', 'P'],
      ['10:00', 'Pigmentação', 'Pedro', '120', 'D'],
      ['11:00', 'Corte', 'Lucas', 'quarenta', 'P'],
    ],
  },
  { titulo: 'Resumo', linhas: [['nada']] },
];
const CENTAVOS = 100;
const CASAS = 2;
const reais = (centavos: number) => (centavos / CENTAVOS).toFixed(CASAS);
/** O que a planilha acima deve render: */
const ATENDIMENTOS_VALIDOS = 2;
const LINHA_DO_LUCAS = 5;
const PRECO_PIGMENTACAO = '120.00';

describe('ImportacoesService', () => {
  let service: ImportacoesService;
  const banco = {
    cliente: { findMany: vi.fn(), createManyAndReturn: vi.fn() },
    servico: { findMany: vi.fn(), createManyAndReturn: vi.fn() },
    atendimento: { createMany: vi.fn() },
  };
  const prisma = {
    ...banco,
    $transaction: vi.fn(async (fn: (tx: typeof banco) => Promise<unknown>) => fn(banco)),
  };
  const google = { lerTodasAbas: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    google.lerTodasAbas.mockResolvedValue(ABAS);
    // Já existem: cliente "João" e serviço "Corte"
    banco.cliente.findMany.mockResolvedValue([{ id: 'c-joao', nome: 'João' }]);
    banco.servico.findMany.mockResolvedValue([{ id: 's-corte', nome: 'Corte' }]);
    banco.cliente.createManyAndReturn.mockImplementation(({ data }) =>
      Promise.resolve(data.map((c: { nome: string }) => ({ id: `c-${c.nome}`, nome: c.nome }))),
    );
    banco.servico.createManyAndReturn.mockImplementation(({ data }) =>
      Promise.resolve(data.map((s: { nome: string }) => ({ id: `s-${s.nome}`, nome: s.nome }))),
    );
    banco.atendimento.createMany.mockImplementation(({ data }) => Promise.resolve({ count: data.length }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportacoesService,
        { provide: PrismaService, useValue: prisma },
        { provide: GoogleService, useValue: google },
      ],
    }).compile();
    service = module.get(ImportacoesService);
  });

  describe('prévia', () => {
    it('resume o que vai entrar, sem gravar nada', async () => {
      const previa = await service.previaPlanilha(BARBEARIA, 'u1', { planilha: 'link' });

      expect(previa.resumo).toMatchObject({
        atendimentos: ATENDIMENTOS_VALIDOS,
        dias: 1,
        abasIgnoradas: 1,
        clientesNovos: 1,
        servicosNovos: 1,
        problemas: 1,
      });
      expect(reais(previa.resumo.valorTotalCentavos)).toBe('165.00');
      expect(previa.problemas[0]).toMatchObject({ linhaPlanilha: LINHA_DO_LUCAS, motivo: 'valor "quarenta" não reconhecido' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(banco.atendimento.createMany).not.toHaveBeenCalled();
    });
  });

  describe('importação', () => {
    it('grava em lote numa transação, reaproveitando cliente e serviço existentes', async () => {
      const resultado = await service.importarPlanilha(BARBEARIA, 'u1', { planilha: 'link' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(banco.cliente.createManyAndReturn.mock.calls[0][0].data).toEqual([
        { barbeariaId: BARBEARIA, nome: 'Pedro' },
      ]);
      const [servicoNovo] = banco.servico.createManyAndReturn.mock.calls[0][0].data;
      expect(servicoNovo.nome).toBe('Pigmentação');
      expect(reais(servicoNovo.precoCentavos)).toBe(PRECO_PIGMENTACAO);
      const gravados = banco.atendimento.createMany.mock.calls[0][0].data;
      expect(gravados.map((a: { clienteId: string; servicoId: string }) => `${a.clienteId}/${a.servicoId}`)).toEqual([
        'c-joao/s-corte',
        'c-Pedro/s-Pigmentação',
      ]);
      expect(resultado).toMatchObject({ clientesCriados: 1, servicosCriados: 1, atendimentosCriados: ATENDIMENTOS_VALIDOS });
      expect(resultado.avisos).toEqual([
        expect.stringContaining('Aba "Resumo" ignorada'),
        '1 linha(s) com problema não foram importadas (veja a lista na prévia)',
      ]);
    });

    it('a prévia e a importação contam os mesmos atendimentos', async () => {
      const previa = await service.previaArquivo(BARBEARIA, Buffer.from(''), 'x.xlsx').catch(() => null);
      // Arquivo vazio não é planilha: a prévia recusa antes de tocar no banco
      expect(previa).toBeNull();

      const [porPrevia, porImportacao] = [
        await service.previaPlanilha(BARBEARIA, 'u1', { planilha: 'link' }),
        await service.importarPlanilha(BARBEARIA, 'u1', { planilha: 'link' }),
      ];
      expect(porImportacao.atendimentosCriados).toBe(porPrevia.resumo.atendimentos);
    });

    it('planilha sem nenhuma linha válida não abre nada no banco além da transação', async () => {
      google.lerTodasAbas.mockResolvedValue([{ titulo: 'Resumo', linhas: [] }]);

      const resultado = await service.importarPlanilha(BARBEARIA, 'u1', { planilha: 'link' });

      expect(resultado).toMatchObject({ clientesCriados: 0, servicosCriados: 0, atendimentosCriados: 0 });
      expect(banco.atendimento.createMany).not.toHaveBeenCalled();
    });
  });
});
