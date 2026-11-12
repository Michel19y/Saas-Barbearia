import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { AgendamentosService } from './agendamentos.service.js';

describe('AgendamentosService.update', () => {
  let service: AgendamentosService;
  let prisma: {
    cliente: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    agendamento: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    servico: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let transaction: {
    agendamento: {
      update: ReturnType<typeof vi.fn>;
    };
    atendimento: {
      upsert: ReturnType<typeof vi.fn>;
    };
  };

  const inicio = new Date('2026-11-11T13:00:00.000Z');
  const existente = {
    id: 'agendamento-1',
    barbeariaId: 'barbearia-1',
    clienteId: 'cliente-1',
    clienteNome: 'João Silva',
    servicoId: 'servico-1',
    profissionalId: 'profissional-1',
    inicio,
    fim: new Date('2026-11-11T13:30:00.000Z'),
    status: 'PENDENTE',
    observacao: null,
    atendimento: null,
  };

  beforeEach(async () => {
    transaction = {
      agendamento: {
        update: vi.fn().mockResolvedValue({
          ...existente,
          status: 'CONCLUIDO',
          cliente: { nome: 'João Silva' },
          servico: { nome: 'Corte', precoCentavos: 5000 },
          profissional: { nome: 'Marcos' },
        }),
      },
      atendimento: {
        upsert: vi.fn().mockResolvedValue({ id: 'atendimento-1' }),
      },
    };

    prisma = {
      cliente: {
        findUnique: vi.fn(),
      },
      agendamento: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(existente),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      servico: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendamentosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AgendamentosService);
  });

  it('creates one linked attendance with the selected payment when concluding', async () => {
    await service.update('barbearia-1', 'agendamento-1', {
      status: 'CONCLUIDO',
      formaPagamento: 'Pix',
    });

    expect(transaction.agendamento.update).toHaveBeenCalledOnce();
    expect(transaction.atendimento.upsert).toHaveBeenCalledWith({
      where: { agendamentoId: 'agendamento-1' },
      create: {
        agendamentoId: 'agendamento-1',
        barbeariaId: 'barbearia-1',
        clienteId: 'cliente-1',
        clienteNome: 'João Silva',
        servicoId: 'servico-1',
        data: inicio,
        formaPagamento: 'Pix',
        valorCentavos: 5000,
        profissionalNome: 'Marcos',
      },
      update: {
        clienteId: 'cliente-1',
        clienteNome: 'João Silva',
        servicoId: 'servico-1',
        data: inicio,
        formaPagamento: 'Pix',
        valorCentavos: 5000,
        profissionalNome: 'Marcos',
      },
    });
  });

  it('creates an appointment with a quick identification and no client record', async () => {
    prisma.servico.findUnique.mockResolvedValue({
      id: 'servico-1',
      barbeariaId: 'barbearia-1',
      duracaoMin: 30,
    });

    await service.create('barbearia-1', 'profissional-1', {
      clienteNome: ' veio ',
      servicoId: 'servico-1',
      inicio: inicio.toISOString(),
    });

    expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
    expect(prisma.agendamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          barbeariaId: 'barbearia-1',
          clienteId: null,
          clienteNome: 'veio',
        }),
      }),
    );
  });

  it('does not allow linking a client from another barbershop', async () => {
    prisma.cliente.findUnique.mockResolvedValue({
      id: 'cliente-estrangeiro',
      barbeariaId: 'barbearia-2',
      nome: 'Cliente de outra barbearia',
    });

    await expect(
      service.create('barbearia-1', 'profissional-1', {
        clienteId: 'cliente-estrangeiro',
        servicoId: 'servico-1',
        inicio: inicio.toISOString(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.agendamento.create).not.toHaveBeenCalled();
  });

  it('keeps quick identification in the attendance history when concluding', async () => {
    transaction.agendamento.update.mockResolvedValueOnce({
      ...existente,
      clienteId: null,
      clienteNome: 'pia 2',
      status: 'CONCLUIDO',
      cliente: null,
      servico: { nome: 'Corte', precoCentavos: 5000 },
      profissional: { nome: 'Marcos' },
    });

    await service.update('barbearia-1', 'agendamento-1', {
      status: 'CONCLUIDO',
      clienteNome: ' pia 2 ',
      formaPagamento: 'Pix',
    });

    expect(transaction.agendamento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clienteId: null,
          clienteNome: 'pia 2',
        }),
      }),
    );
    expect(transaction.atendimento.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          clienteId: null,
          clienteNome: 'pia 2',
        }),
        update: expect.objectContaining({
          clienteId: null,
          clienteNome: 'pia 2',
        }),
      }),
    );
  });

  it('requires an other-payment description before concluding', async () => {
    await expect(
      service.update('barbearia-1', 'agendamento-1', {
        status: 'CONCLUIDO',
        formaPagamento: 'Outro',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not update an appointment from another barbershop', async () => {
    prisma.agendamento.findUnique.mockResolvedValue({
      ...existente,
      barbeariaId: 'barbearia-2',
    });

    await expect(
      service.update('barbearia-1', 'agendamento-1', {
        status: 'CONCLUIDO',
        formaPagamento: 'Pix',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.agendamento.update).not.toHaveBeenCalled();
    expect(transaction.atendimento.upsert).not.toHaveBeenCalled();
  });
});
