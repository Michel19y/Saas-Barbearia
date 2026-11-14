import { ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfissionaisService } from './profissionais.service.js';

describe('ProfissionaisService.create', () => {
  let service: ProfissionaisService;
  const prisma = {
    usuario: { findUnique: vi.fn(), create: vi.fn() },
  };
  const dto = { nome: 'Carlos', email: 'Carlos@Exemplo.test', senha: 'senha-de-teste' };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockImplementation(({ data }) => Promise.resolve(data));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfissionaisService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProfissionaisService);
  });

  it('confere o e-mail no sistema inteiro, não só na barbearia', async () => {
    await service.create('barbearia-1', dto);

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: { email: 'carlos@exemplo.test' },
    });
    expect(prisma.usuario.create.mock.calls[0][0].data.email).toBe('carlos@exemplo.test');
  });

  it('recusa e-mail que já existe em outra barbearia', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'x', barbeariaId: 'barbearia-2' });

    await expect(service.create('barbearia-1', dto)).rejects.toThrow(
      new ConflictException('Esse e-mail já está cadastrado'),
    );
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('converte a violação de índice único em 409', async () => {
    prisma.usuario.create.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });

    await expect(service.create('barbearia-1', dto)).rejects.toThrow(ConflictException);
  });
});
