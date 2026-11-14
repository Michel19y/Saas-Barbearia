import { ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { BarbeariaService } from './barbearia.service.js';
import { UpdateBarbeariaDto } from './dto/update-barbearia.dto.js';

const ID = 'barbearia-1';
const atual = { nome: 'Barbearia Teste', slug: 'barbearia-teste', telefone: null, enderecoCidade: null };

describe('BarbeariaService.atualizar', () => {
  let service: BarbeariaService;
  const tx = {
    slugAntigo: { deleteMany: vi.fn(), upsert: vi.fn() },
    barbearia: { update: vi.fn() },
  };
  const prisma = {
    barbearia: { findUnique: vi.fn(), update: vi.fn() },
    slugAntigo: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // 1ª chamada: minha(); demais: checagem de slug livre (ninguém usa)
    prisma.barbearia.findUnique.mockResolvedValueOnce(atual).mockResolvedValue(null);
    prisma.slugAntigo.findUnique.mockResolvedValue(null);
    prisma.barbearia.update.mockImplementation(({ data }) => Promise.resolve({ ...atual, ...data }));
    tx.barbearia.update.mockImplementation(({ data }) => Promise.resolve({ ...atual, ...data }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [BarbeariaService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BarbeariaService);
  });

  it('mudar só o nome não mexe no link', async () => {
    const r = await service.atualizar(ID, { nome: 'Barbearia Michel' });

    expect(r.slug).toBe('barbearia-teste');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('mudar o link guarda o antigo (reservado) e grava o novo', async () => {
    const r = await service.atualizar(ID, { nome: 'Barbearia Michel', slug: 'barbearia-michel' });

    expect(tx.slugAntigo.upsert).toHaveBeenCalledWith({
      where: { slug: 'barbearia-teste' },
      create: { slug: 'barbearia-teste', barbeariaId: ID },
      update: {},
    });
    expect(tx.barbearia.update.mock.calls[0][0].data).toEqual({
      nome: 'Barbearia Michel',
      slug: 'barbearia-michel',
    });
    expect(r.slug).toBe('barbearia-michel');
  });

  it('voltar para um link que já foi seu tira ele da lista de antigos', async () => {
    prisma.slugAntigo.findUnique.mockResolvedValue({ barbeariaId: ID });

    await service.atualizar(ID, { slug: 'barbearia-michel' });

    expect(tx.slugAntigo.deleteMany).toHaveBeenCalledWith({
      where: { slug: 'barbearia-michel', barbeariaId: ID },
    });
  });

  it('recusa link atual de outra barbearia', async () => {
    prisma.barbearia.findUnique.mockReset();
    prisma.barbearia.findUnique.mockResolvedValueOnce(atual).mockResolvedValue({ id: 'outra' });

    await expect(service.atualizar(ID, { slug: 'barbearia-centro' })).rejects.toThrow(
      new ConflictException('Esse link já está em uso, escolha outro'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recusa link antigo de outra barbearia', async () => {
    prisma.slugAntigo.findUnique.mockResolvedValue({ barbeariaId: 'outra' });

    await expect(service.atualizar(ID, { slug: 'link-antigo-dela' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('converte corrida no índice único em 409', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.atualizar(ID, { slug: 'barbearia-michel' })).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('UpdateBarbeariaDto.slug', () => {
  const validar = async (slug: string) => {
    const dto = plainToInstance(UpdateBarbeariaDto, { slug });
    return { dto, erros: await validate(dto) };
  };

  it('normaliza texto livre: "Barbearia do Zé!" vira "barbearia-do-ze"', async () => {
    const { dto, erros } = await validar('  Barbearia do Zé! ');
    expect(erros).toHaveLength(0);
    expect(dto.slug).toBe('barbearia-do-ze');
  });

  it('recusa link curto demais', async () => {
    const { erros } = await validar('ab');
    expect(erros).not.toHaveLength(0);
  });

  it('recusa link que vira vazio', async () => {
    const { erros } = await validar('!!!');
    expect(erros).not.toHaveLength(0);
  });
});
