import { ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClientesService } from './clientes.service.js';

describe('ClientesService.remove', () => {
  let service: ClientesService;
  const transaction = {
    agendamento: { updateMany: vi.fn() },
    atendimento: { updateMany: vi.fn() },
    cliente: { delete: vi.fn() },
  };
  const prisma = {
    cliente: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<void>) =>
        callback(transaction),
    ),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.cliente.findUnique.mockResolvedValue({
      id: 'cliente-1',
      barbeariaId: 'barbearia-1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ClientesService);
  });

  it('removes identifying snapshots from linked records before deleting the client', async () => {
    await service.remove('barbearia-1', 'cliente-1');

    expect(transaction.agendamento.updateMany).toHaveBeenCalledWith({
      where: { barbeariaId: 'barbearia-1', clienteId: 'cliente-1' },
      data: { clienteNome: 'Cliente excluído' },
    });
    expect(transaction.atendimento.updateMany).toHaveBeenCalledWith({
      where: { barbeariaId: 'barbearia-1', clienteId: 'cliente-1' },
      data: { clienteNome: 'Cliente excluído' },
    });
    expect(transaction.cliente.delete).toHaveBeenCalledWith({
      where: { id: 'cliente-1' },
    });
  });

  it('does not delete a client belonging to another barbershop', async () => {
    prisma.cliente.findUnique.mockResolvedValue({
      id: 'cliente-1',
      barbeariaId: 'barbearia-2',
    });

    await expect(
      service.remove('barbearia-1', 'cliente-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.cliente.delete).not.toHaveBeenCalled();
  });
});
