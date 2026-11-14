import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { slugify } from './slugify.js';

export const SLUG_MIN = 3;
export const SLUG_MAX = 60;
/**
 * Só minúsculas, números e hífens simples entre eles.
 * Aceita "barbearia-michel" e "barba2"; recusa "Barbearia", "-michel", "barba--sp" e "barba sp".
 * https://regex101.com/?flavor=javascript&regex=%5E%5Ba-z0-9%5D%2B(%3F%3A-%5Ba-z0-9%5D%2B)*%24&testString=barbearia-michel%0Abarba2%0ABarbearia%0A-michel%0Abarba--sp%0Abarba%20sp
 */
export const SLUG_FORMATO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MENSAGEM_SLUG_EM_USO = 'Esse link já está em uso, escolha outro';
const SLUG_PADRAO = 'barbearia';

type Prisma = Pick<PrismaService, 'barbearia' | 'slugAntigo'>;

/** Slug a partir do nome; cai em `barbearia` se o nome não tiver letras nem números. */
export function slugDoNome(nome: string): string {
  return slugify(slugify(nome).slice(0, SLUG_MAX)) || SLUG_PADRAO;
}

/**
 * O slug está livre para `barbeariaId`? Ocupado quando é o link atual de outra
 * barbearia ou um link antigo (reservado) de outra barbearia.
 */
export async function slugLivrePara(
  prisma: Prisma,
  slug: string,
  barbeariaId?: string,
): Promise<boolean> {
  const [atual, antigo] = await Promise.all([
    prisma.barbearia.findUnique({ where: { slug }, select: { id: true } }),
    prisma.slugAntigo.findUnique({ where: { slug }, select: { barbeariaId: true } }),
  ]);
  const deOutra = (id?: string) => id !== undefined && id !== barbeariaId;
  return !deOutra(atual?.id) && !deOutra(antigo?.barbeariaId);
}

/** `base` se estiver livre; senão `base-N` com o menor N >= 2 que não seja link atual nem antigo. */
export async function proximoSlugLivre(prisma: Prisma, base: string): Promise<string> {
  const filtro = { where: { slug: { startsWith: base } }, select: { slug: true } };
  const [atuais, antigos] = await Promise.all([
    prisma.barbearia.findMany(filtro),
    prisma.slugAntigo.findMany(filtro),
  ]);
  const usados = new Set([...atuais, ...antigos].map((b) => b.slug));
  const candidatos = Array.from({ length: usados.size + 1 }, (_, i) =>
    i === 0 ? base : `${base}-${i + 1}`,
  );
  return candidatos.find((s) => !usados.has(s)) ?? base;
}

/** Acha a barbearia pelo link atual ou por um link antigo dela. */
export async function barbeariaPorSlug(prisma: Prisma, slug: string) {
  const atual = await prisma.barbearia.findUnique({ where: { slug } });
  if (atual) return atual;
  const antigo = await prisma.slugAntigo.findUnique({
    where: { slug },
    include: { barbearia: true },
  });
  if (!antigo) throw new NotFoundException('Barbearia não encontrada');
  return antigo.barbearia;
}

/** Violação de índice único em slug (duas barbearias pegando o mesmo link ao mesmo tempo). */
export function tratarSlugDuplicado(erro: unknown): never {
  const e = erro as { code?: string } | null;
  if (e?.code === 'P2002') throw new ConflictException(MENSAGEM_SLUG_EM_USO);
  throw erro;
}
