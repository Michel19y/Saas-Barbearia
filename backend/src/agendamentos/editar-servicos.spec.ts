import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { AgendamentosService } from './agendamentos.service.js';

const BARBEARIA = 'b1';
const em = (hora: string) => new Date(`2026-11-15T${hora}:00-03:00`);
/** Hora "HH:MM" de Brasília de um instante, para ler os testes como a agenda. */
const hora = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d);

const MEIA_HORA = 30;
const QUINZE_MIN = 15;

const SERVICOS = {
  barba: { id: 'barba', barbeariaId: BARBEARIA, nome: 'Barba', duracaoMin: MEIA_HORA },
  sobrancelha: { id: 'sobrancelha', barbeariaId: BARBEARIA, nome: 'Sobrancelha', duracaoMin: QUINZE_MIN },
  corte: { id: 'corte', barbeariaId: BARBEARIA, nome: 'Corte', duracaoMin: MEIA_HORA },
};

/** Barba das 20:00 às 20:30, marcada como um serviço só. */
const BARBA_DAS_20 = {
  id: 'a1',
  barbeariaId: BARBEARIA,
  profissionalId: 'michel',
  clienteId: 'c1',
  clienteNome: 'João',
  servicoId: 'barba',
  inicio: em('20:00'),
  fim: em('20:30'),
  status: 'CONFIRMADO',
  observacao: null,
  grupoId: null,
};

describe('AgendamentosService.editarServicos', () => {
  let service: AgendamentosService;
  const tx = {
    agendamento: { update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  };
  const prisma = {
    agendamento: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    servico: { findMany: vi.fn() },
    cliente: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.agendamento.findUnique.mockResolvedValue(BARBA_DAS_20);
    prisma.agendamento.findFirst.mockResolvedValue(null);
    prisma.servico.findMany.mockImplementation(({ where }) =>
      Promise.resolve(where.id.in.map((id: keyof typeof SERVICOS) => SERVICOS[id]).filter(Boolean)),
    );
    tx.agendamento.update.mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data }));
    tx.agendamento.create.mockImplementation(({ data }) => Promise.resolve({ id: `novo-${data.servicoId}`, ...data }));
    prisma.agendamento.findMany.mockResolvedValue([]);

    const modulo = await Test.createTestingModule({
      providers: [AgendamentosService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = modulo.get(AgendamentosService);
  });

  it('barba das 20:00 + sobrancelha: mantém a barba e cria a sobrancelha logo depois, no mesmo atendimento', async () => {
    await service.editarServicos(BARBEARIA, 'a1', { servicoIds: ['barba', 'sobrancelha'] });

    const barba = tx.agendamento.update.mock.calls[0][0];
    const sobrancelha = tx.agendamento.create.mock.calls[0][0].data;
    expect(barba.where.id).toBe('a1');
    expect([hora(barba.data.inicio), hora(barba.data.fim)]).toEqual(['20:00', '20:30']);
    expect([hora(sobrancelha.inicio), hora(sobrancelha.fim)]).toEqual(['20:30', '20:45']);
    // Os dois ficam no mesmo grupo, com o mesmo cliente, profissional e status
    expect(sobrancelha.grupoId).toBe(barba.data.grupoId);
    expect(sobrancelha.grupoId).not.toBeNull();
    expect(sobrancelha).toMatchObject({ profissionalId: 'michel', clienteNome: 'João', status: 'CONFIRMADO' });
  });

  it('confere conflito com o horário estendido, ignorando o próprio atendimento', async () => {
    await service.editarServicos(BARBEARIA, 'a1', { servicoIds: ['barba', 'sobrancelha'] });

    const { where } = prisma.agendamento.findFirst.mock.calls[0][0];
    expect(where.id).toEqual({ notIn: ['a1'] });
    expect(hora(where.fim.gt)).toBe('20:00');
    expect(hora(where.inicio.lt)).toBe('20:45');
  });

  it('se o horário estendido bater com outro cliente, recusa e não grava nada', async () => {
    prisma.agendamento.findFirst.mockResolvedValue({ id: 'outro' });

    await expect(service.editarServicos(BARBEARIA, 'a1', { servicoIds: ['barba', 'sobrancelha'] })).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('tirar um serviço de um atendimento com dois apaga o que sobrou e desfaz o grupo', async () => {
    prisma.agendamento.findUnique.mockResolvedValue({ ...BARBA_DAS_20, grupoId: 'g1' });
    prisma.agendamento.findMany.mockResolvedValueOnce([
      { ...BARBA_DAS_20, grupoId: 'g1' },
      { ...BARBA_DAS_20, id: 'a2', servicoId: 'sobrancelha', inicio: em('20:30'), fim: em('20:45'), grupoId: 'g1' },
    ]);

    await service.editarServicos(BARBEARIA, 'a1', { servicoIds: ['barba'] });

    expect(tx.agendamento.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a2'] } } });
    expect(tx.agendamento.update.mock.calls[0][0].data.grupoId).toBeNull();
    expect(tx.agendamento.create).not.toHaveBeenCalled();
  });

  it('trocar o horário leva todos os serviços junto, em sequência', async () => {
    await service.editarServicos(BARBEARIA, 'a1', {
      servicoIds: ['corte', 'barba'],
      inicio: em('19:00').toISOString(),
    });

    const corte = tx.agendamento.update.mock.calls[0][0].data;
    const barba = tx.agendamento.create.mock.calls[0][0].data;
    expect([hora(corte.inicio), hora(corte.fim), corte.servicoId]).toEqual(['19:00', '19:30', 'corte']);
    expect([hora(barba.inicio), hora(barba.fim), barba.servicoId]).toEqual(['19:30', '20:00', 'barba']);
  });

  it('atendimento já concluído não muda de serviços (já foi para o Financeiro)', async () => {
    prisma.agendamento.findUnique.mockResolvedValue({ ...BARBA_DAS_20, status: 'CONCLUIDO' });

    await expect(service.editarServicos(BARBEARIA, 'a1', { servicoIds: ['barba', 'sobrancelha'] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('não aceita serviço de outra barbearia', async () => {
    await expect(service.editarServicos(BARBEARIA, 'a1', { servicoIds: ['barba', 'de-outra-loja'] })).rejects.toThrow(
      'Um ou mais serviços não encontrados',
    );
  });

  it('agendamento de outra barbearia é proibido', async () => {
    prisma.agendamento.findUnique.mockResolvedValue({ ...BARBA_DAS_20, barbeariaId: 'outra' });
    await expect(service.editarServicos(BARBEARIA, 'a1', { servicoIds: ['barba'] })).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
