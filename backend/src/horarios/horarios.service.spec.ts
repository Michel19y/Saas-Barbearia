import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HorariosService } from './horarios.service.js';
import { DIAS_DA_SEMANA } from './expediente.js';

const BARBEARIA = 'b1';
const AGORA = new Date('2026-11-14T12:00:00-03:00');
const DIA = '2026-12-10';
const OUTRO_DIA = '2026-12-11';

const em = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`);
const MEIA_HORA_MS = 1_800_000;
const QUINTA_FEIRA = 4;

/** Agendamento futuro de 30 min no formato que o Prisma devolve (com cliente, serviço e profissional). */
function agendamento(id: string, profissionalId: string, data: string, hora: string, grupoId: string | null = null) {
  const inicio = em(data, hora);
  return {
    id,
    profissionalId,
    inicio,
    fim: new Date(inicio.getTime() + MEIA_HORA_MS),
    grupoId,
    clienteNome: `Cliente ${id}`,
    cliente: { telefone: `1199999000${id.slice(-1)}` },
    servico: { nome: 'Corte' },
    profissional: { nome: profissionalId === 'ana' ? 'Ana' : 'Bruno' },
  };
}

describe('HorariosService', () => {
  let service: HorariosService;
  const banco = {
    barbearia: { findUnique: vi.fn(), update: vi.fn() },
    usuario: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    excecaoHorario: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agendamento: { findMany: vi.fn(), updateMany: vi.fn() },
  };
  const prisma = { ...banco, $transaction: vi.fn(async (fn: (tx: typeof banco) => Promise<unknown>) => fn(banco)) };

  const AGENDA = [
    agendamento('a1', 'ana', DIA, '10:00'),
    agendamento('a2', 'bruno', DIA, '15:00'),
    agendamento('a3', 'ana', OUTRO_DIA, '10:00'),
  ];

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    vi.clearAllMocks();
    banco.barbearia.findUnique.mockResolvedValue({ horarioSemanal: null });
    banco.usuario.findMany.mockResolvedValue([
      { id: 'ana', horarioSemanal: null },
      { id: 'bruno', horarioSemanal: null },
    ]);
    banco.usuario.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({ id: where.id, barbeariaId: where.id === 'intrusa' ? 'outra' : BARBEARIA }),
    );
    banco.excecaoHorario.findMany.mockResolvedValue([]);
    banco.excecaoHorario.findFirst.mockResolvedValue(null);
    banco.agendamento.findMany.mockResolvedValue(AGENDA);

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [HorariosService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = modulo.get(HorariosService);
  });

  afterEach(() => vi.useRealTimers());

  const fecharDia = { tipo: 'excecao' as const, data: DIA, fechado: true };

  describe('simular', () => {
    it('fechar a barbearia no dia lista quem estava marcado nele, com telefone', async () => {
      const { afetados } = await service.simular(BARBEARIA, fecharDia);

      expect(afetados.map((a) => `${a.id} ${a.profissional} ${a.telefone}`)).toEqual([
        'a1 Ana 11999990001',
        'a2 Bruno 11999990002',
      ]);
      expect(banco.excecaoHorario.create).not.toHaveBeenCalled();
    });

    it('folga só da Ana no dia pega só os agendamentos dela', async () => {
      const { afetados } = await service.simular(BARBEARIA, { ...fecharDia, profissionalId: 'ana' });
      expect(afetados.map((a) => a.id)).toEqual(['a1']);
    });

    it('encurtar o dia para 14h–18h tira só quem estava de manhã', async () => {
      const { afetados } = await service.simular(BARBEARIA, {
        tipo: 'excecao',
        data: DIA,
        fechado: false,
        inicio: '14:00',
        fim: '18:00',
      });
      expect(afetados.map((a) => a.id)).toEqual(['a1']);
    });

    it('mudar a semana (toda quinta fechada) pega todas as quintas futuras', async () => {
      const semana = Array.from({ length: DIAS_DA_SEMANA }, (_, dia) => ({ aberto: dia !== QUINTA_FEIRA, inicio: '09:00', fim: '21:00' }));
      const { afetados } = await service.simular(BARBEARIA, { tipo: 'semana', semana });
      expect(afetados.map((a) => a.id)).toEqual(['a1', 'a2']);
    });

    it('serviços do mesmo grupo saem juntos, mesmo se só um passar do horário', async () => {
      banco.agendamento.findMany.mockResolvedValue([
        agendamento('g1', 'ana', DIA, '17:30', 'grupo'),
        agendamento('g2', 'ana', DIA, '18:00', 'grupo'),
      ]);
      const { afetados } = await service.simular(BARBEARIA, {
        tipo: 'excecao',
        data: DIA,
        fechado: false,
        inicio: '09:00',
        fim: '18:00',
      });
      expect(afetados.map((a) => a.id)).toEqual(['g1', 'g2']);
    });

    it('agendamento que já estava fora do horário (encaixe do dono) não conta como afetado', async () => {
      banco.agendamento.findMany.mockResolvedValue([agendamento('x', 'ana', DIA, '22:00')]);
      const { afetados } = await service.simular(BARBEARIA, {
        tipo: 'excecao',
        data: DIA,
        fechado: false,
        inicio: '14:00',
        fim: '18:00',
      });
      expect(afetados).toEqual([]);
    });
  });

  describe('aplicar', () => {
    it('com agendamentos afetados e sem confirmar: 409 com a lista, nada gravado', async () => {
      const erro = await service.aplicar(BARBEARIA, fecharDia).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ConflictException);
      expect((erro as ConflictException).getResponse()).toMatchObject({
        afetados: [expect.objectContaining({ id: 'a1' }), expect.objectContaining({ id: 'a2' })],
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('confirmando: grava a exceção e cancela os afetados juntos', async () => {
      const { cancelados } = await service.aplicar(BARBEARIA, fecharDia, true);

      expect(banco.excecaoHorario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ barbeariaId: BARBEARIA, profissionalId: null, data: DIA, fechado: true }),
      });
      expect(banco.agendamento.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a1', 'a2'] }, barbeariaId: BARBEARIA },
        data: { status: 'CANCELADO' },
      });
      expect(cancelados.map((a) => a.id)).toEqual(['a1', 'a2']);
    });

    it('sem ninguém afetado aplica direto, sem pedir confirmação', async () => {
      banco.agendamento.findMany.mockResolvedValue([]);
      await service.aplicar(BARBEARIA, fecharDia);
      expect(banco.excecaoHorario.create).toHaveBeenCalled();
      expect(banco.agendamento.updateMany).not.toHaveBeenCalled();
    });

    it('exceção no mesmo dia é atualizada, não duplicada', async () => {
      banco.agendamento.findMany.mockResolvedValue([]);
      banco.excecaoHorario.findFirst.mockResolvedValue({ id: 'e1' });
      await service.aplicar(BARBEARIA, { ...fecharDia, fechado: false, inicio: '14:00', fim: '18:00' });
      expect(banco.excecaoHorario.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: expect.objectContaining({ fechado: false, inicio: '14:00', fim: '18:00' }),
      });
      expect(banco.excecaoHorario.create).not.toHaveBeenCalled();
    });
  });

  describe('validação', () => {
    it.each([
      [{ tipo: 'excecao', data: '2026-11-01', fechado: true }, 'Essa data já passou'],
      [{ tipo: 'excecao', data: '10/12/2026', fechado: true }, 'Data inválida (use AAAA-MM-DD)'],
      [{ tipo: 'excecao', data: DIA, fechado: false, inicio: '18:00', fim: '14:00' }, 'Horário inválido'],
      [{ tipo: 'semana', semana: [{ aberto: true }] }, 'Horário da semana inválido'],
    ] as const)('recusa %j', async (dto, mensagem) => {
      await expect(service.simular(BARBEARIA, dto)).rejects.toThrow(BadRequestException);
      await expect(service.simular(BARBEARIA, dto)).rejects.toThrow(mensagem);
    });

    it('profissional de outra barbearia não existe para quem pede', async () => {
      await expect(service.simular(BARBEARIA, { ...fecharDia, profissionalId: 'intrusa' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('não remove exceção de outra barbearia', async () => {
      banco.excecaoHorario.findUnique.mockResolvedValue({ id: 'e9', barbeariaId: 'outra' });
      await expect(service.aplicar(BARBEARIA, { tipo: 'remover-excecao', excecaoId: 'e9' })).rejects.toThrow(
        'Exceção não encontrada',
      );
      expect(banco.excecaoHorario.delete).not.toHaveBeenCalled();
    });
  });
});
