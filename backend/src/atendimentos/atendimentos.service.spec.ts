import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtendimentosService } from './atendimentos.service.js';

const DURACAO_MIN = 30;
const PRECO_ATUAL_CENTAVOS = 5000;
const VALOR_PAGO_CENTAVOS = 4500;

describe('AtendimentosService.historicoImportado', () => {
  let service: AtendimentosService;
  const prisma = { atendimento: { findMany: vi.fn() } };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtendimentosService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AtendimentosService);
  });

  it('busca só atendimentos da barbearia que não vieram de agendamento', async () => {
    prisma.atendimento.findMany.mockResolvedValue([]);

    await service.historicoImportado('barbearia-1');

    expect(prisma.atendimento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { barbeariaId: 'barbearia-1', agendamentoId: null } }),
    );
  });

  it('devolve no formato da agenda, concluído, com o valor pago e a origem na observação', async () => {
    prisma.atendimento.findMany.mockResolvedValue([
      {
        id: 'a1',
        clienteId: 'c1',
        clienteNome: 'João Silva',
        cliente: { id: 'c1', nome: 'João Silva' },
        servicoId: 's1',
        servico: { id: 's1', nome: 'Corte', duracaoMin: DURACAO_MIN, precoCentavos: PRECO_ATUAL_CENTAVOS },
        data: new Date('2026-11-10T12:00:00.000Z'),
        valorCentavos: VALOR_PAGO_CENTAVOS,
        formaPagamento: 'Pix',
        profissionalNome: 'Henrique',
      },
    ]);

    const [item] = await service.historicoImportado('barbearia-1');

    expect(item).toMatchObject({
      id: 'importado:a1',
      importado: true,
      status: 'CONCLUIDO',
      clienteNome: 'João Silva',
      servico: { nome: 'Corte', precoCentavos: VALOR_PAGO_CENTAVOS },
      grupoId: null,
      observacao: 'Importado da planilha · Profissional: Henrique · Pix',
    });
    expect(item.fim.toISOString()).toBe('2026-11-10T12:30:00.000Z');
  });

  it('omite o profissional quando a planilha não informou', async () => {
    prisma.atendimento.findMany.mockResolvedValue([
      {
        id: 'a2',
        clienteId: null,
        clienteNome: 'Bruno',
        cliente: null,
        servicoId: 's1',
        servico: { duracaoMin: DURACAO_MIN },
        data: new Date('2026-11-11T12:00:00.000Z'),
        valorCentavos: 0,
        formaPagamento: 'Não informado',
        profissionalNome: null,
      },
    ]);

    const [item] = await service.historicoImportado('barbearia-1');
    expect(item.observacao).toBe('Importado da planilha · Não informado');
  });
});
