import { ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HorariosService } from '../horarios/horarios.service.js';
import type { ConfigExpediente } from '../horarios/expediente.js';
import { PublicoService } from './publico.service.js';

const AGORA = new Date('2026-11-14T12:00:00-03:00');
const DIA = '2026-12-10';
const DURACAO_CORTE = 30;

/** Horários oferecidos como "HH:MM" de Brasília. */
const horas = (isos: string[]) =>
  isos.map((iso) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    ),
  );

describe('PublicoService com horário de funcionamento', () => {
  let service: PublicoService;
  let config: ConfigExpediente;
  const prisma = {
    barbearia: { findUnique: vi.fn() },
    servico: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
    agendamento: { findMany: vi.fn(), create: vi.fn() },
    cliente: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  const horarios = { carregarConfig: vi.fn(() => Promise.resolve(config)) };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    vi.clearAllMocks();
    config = { barbearia: null, profissionais: {}, excecoes: [] };
    prisma.barbearia.findUnique.mockResolvedValue({ id: 'b1', slug: 'loja', nome: 'Loja' });
    prisma.servico.findMany.mockResolvedValue([{ id: 's1', duracaoMin: DURACAO_CORTE, ativo: true }]);
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'ana', nome: 'Ana' },
      { id: 'bruno', nome: 'Bruno' },
    ]);
    prisma.agendamento.findMany.mockResolvedValue([]);

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        PublicoService,
        { provide: PrismaService, useValue: prisma },
        { provide: HorariosService, useValue: horarios },
      ],
    }).compile();
    service = modulo.get(PublicoService);
  });

  afterEach(() => vi.useRealTimers());

  it('sem configuração continua igual a antes: 09:00 até 20:30', async () => {
    const lista = horas(await service.horariosDisponiveis('loja', 's1', DIA));
    expect([lista[0], lista.at(-1)]).toEqual(['09:00', '20:30']);
  });

  it('dia fechado: nenhum horário e expediente "fechado"', async () => {
    config.excecoes = [{ profissionalId: null, data: DIA, fechado: true, inicio: null, fim: null }];

    expect(await service.horariosDisponiveis('loja', 's1', DIA)).toEqual([]);
    expect(await service.expediente('loja', DIA)).toEqual({ aberto: false });
  });

  it('dia 14h–18h: só oferece horários da tarde que terminam até 18h', async () => {
    config.excecoes = [{ profissionalId: null, data: DIA, fechado: false, inicio: '14:00', fim: '18:00' }];
    expect(horas(await service.horariosDisponiveis('loja', 's1', DIA))).toEqual([
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    ]);
  });

  it('folga da Ana: escolhendo a Ana não há horário; sem escolher, o Bruno atende', async () => {
    config.excecoes = [{ profissionalId: 'ana', data: DIA, fechado: true, inicio: null, fim: null }];

    expect(await service.horariosDisponiveis('loja', 's1', DIA, 'ana')).toEqual([]);
    expect(await service.expediente('loja', DIA, 'ana')).toEqual({ aberto: false });
    expect((await service.horariosDisponiveis('loja', 's1', DIA)).length).toBeGreaterThan(0);
  });

  it('pausa do almoço 12h–13h: corte de 30 min não aparece às 12:00 nem às 12:30', async () => {
    config.excecoes = [
      { profissionalId: null, data: DIA, fechado: false, inicio: '11:00', fim: '14:00', pausaInicio: '12:00', pausaFim: '13:00' },
    ];
    expect(horas(await service.horariosDisponiveis('loja', 's1', DIA))).toEqual(['11:00', '11:30', '13:00', '13:30']);
  });

  it('calendário: devolve só os dias abertos (domingo fechado e folga da barbearia somem)', async () => {
    // Semana: domingo fechado; e a barbearia fecha no dia 10/12 (quinta)
    config.barbearia = Array.from({ length: 7 }, (_, d) => ({ aberto: d !== 0, inicio: '09:00', fim: '19:00' }));
    config.excecoes = [{ profissionalId: null, data: DIA, fechado: true, inicio: null, fim: null }];

    const { abertos } = await service.diasAbertos('loja', '2026-12-09', '5');

    // 09 qua, 10 qui (fechado), 11 sex, 12 sáb, 13 dom (fechado)
    expect(abertos).toEqual(['2026-12-09', '2026-12-11', '2026-12-12']);
  });

  it('calendário com profissional de folga: o dia some só para ele', async () => {
    config.excecoes = [{ profissionalId: 'ana', data: DIA, fechado: true, inicio: null, fim: null }];

    expect((await service.diasAbertos('loja', DIA, '1', 'ana')).abertos).toEqual([]);
    expect((await service.diasAbertos('loja', DIA, '1')).abertos).toEqual([DIA]);
  });

  it('recusa agendamento fora do expediente mesmo vindo direto pela API', async () => {
    config.excecoes = [{ profissionalId: null, data: DIA, fechado: false, inicio: '14:00', fim: '18:00' }];

    await expect(
      service.criarAgendamentoPublico('loja', {
        servicoIds: ['s1'],
        inicio: `${DIA}T10:00:00-03:00`,
        nome: 'Pedro',
        telefone: '11999990000',
      }),
    ).rejects.toThrow(new ConflictException('Esse horário está fora do expediente, escolha outro'));
    expect(prisma.agendamento.create).not.toHaveBeenCalled();
  });

  it('dois clientes no mesmo horário: se a trava do banco recusar, o segundo recebe 409 e nada fica pela metade', async () => {
    prisma.cliente.findFirst.mockResolvedValue({ id: 'c1', nome: 'Pedro' });
    prisma.$transaction.mockRejectedValueOnce({
      message: 'conflicting key value violates exclusion constraint "agendamentos_sem_sobreposicao"',
    });

    await expect(
      service.criarAgendamentoPublico('loja', {
        servicoIds: ['s1'],
        inicio: `${DIA}T10:00:00-03:00`,
        nome: 'Pedro',
        telefone: '11999990000',
      }),
    ).rejects.toThrow(new ConflictException('Esse horário acabou de ser ocupado, escolha outro'));
  });

  it('com folga da Ana, o agendamento "qualquer um" vai para o Bruno', async () => {
    config.excecoes = [{ profissionalId: 'ana', data: DIA, fechado: true, inicio: null, fim: null }];
    prisma.cliente.findFirst.mockResolvedValue({ id: 'c1', nome: 'Pedro' });
    prisma.agendamento.create.mockImplementation(({ data }) => Promise.resolve(data));

    await service.criarAgendamentoPublico('loja', {
      servicoIds: ['s1'],
      inicio: `${DIA}T10:00:00-03:00`,
      nome: 'Pedro',
      telefone: '11999990000',
    });
    expect(prisma.agendamento.create.mock.calls[0][0].data.profissionalId).toBe('bruno');
  });
});
