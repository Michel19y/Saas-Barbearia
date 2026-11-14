import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { barbeariaPorSlug, SLUG_MAX, slugDoNome } from './slug-barbearia.js';

describe('barbeariaPorSlug', () => {
  const barbearia = { id: 'b1', nome: 'Barbearia Michel', slug: 'barbearia-michel' };
  const prisma = {
    barbearia: { findUnique: vi.fn() },
    slugAntigo: { findUnique: vi.fn() },
  };
  const p = prisma as unknown as Pick<PrismaService, 'barbearia' | 'slugAntigo'>;

  beforeEach(() => vi.clearAllMocks());

  it('acha pelo link atual', async () => {
    prisma.barbearia.findUnique.mockResolvedValue(barbearia);

    await expect(barbeariaPorSlug(p, 'barbearia-michel')).resolves.toBe(barbearia);
    expect(prisma.slugAntigo.findUnique).not.toHaveBeenCalled();
  });

  it('acha pelo link antigo e devolve a barbearia com o link atual', async () => {
    prisma.barbearia.findUnique.mockResolvedValue(null);
    prisma.slugAntigo.findUnique.mockResolvedValue({ slug: 'barbearia-teste', barbearia });

    const r = await barbeariaPorSlug(p, 'barbearia-teste');
    expect(r.slug).toBe('barbearia-michel');
  });

  it('404 quando o link não existe nem como antigo', async () => {
    prisma.barbearia.findUnique.mockResolvedValue(null);
    prisma.slugAntigo.findUnique.mockResolvedValue(null);

    await expect(barbeariaPorSlug(p, 'nao-existe')).rejects.toThrow(NotFoundException);
  });
});

describe('slugDoNome', () => {
  it('gera a partir do nome', () => {
    expect(slugDoNome('Barbearia Excellence')).toBe('barbearia-excellence');
  });

  it('cai em "barbearia" quando o nome não tem letras nem números', () => {
    expect(slugDoNome('!!!')).toBe('barbearia');
  });

  it('corta nomes longos sem deixar hífen no fim', () => {
    // O hífen entre "aaa…" e "b" cai exatamente na posição do corte
    const slug = slugDoNome(`${'a'.repeat(SLUG_MAX - 1)} b`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug.endsWith('-')).toBe(false);
  });
});
