import { ConflictException } from '@nestjs/common';
import { Transform } from 'class-transformer';

export const MENSAGEM_EMAIL_EM_USO = 'Esse e-mail já está cadastrado';

/** Erro do Prisma de violação de índice único (ex.: dois cadastros simultâneos com o mesmo e-mail). */
export function ehEmailDuplicado(erro: unknown): boolean {
  const e = erro as { code?: string; meta?: unknown } | null;
  if (e?.code !== 'P2002') return false;
  // O campo aparece em meta.target ou, com driver adapter, dentro de meta.driverAdapterError
  return e.meta === undefined || JSON.stringify(e.meta).includes('email');
}

/** Converte a violação de e-mail único em 409 com mensagem amigável; repassa outros erros. */
export function tratarEmailDuplicado(erro: unknown): never {
  if (ehEmailDuplicado(erro)) throw new ConflictException(MENSAGEM_EMAIL_EM_USO);
  throw erro;
}

/** E-mail de usuário é guardado e comparado sempre sem espaços e em minúsculas. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Aplica `normalizarEmail` no campo do DTO antes da validação. */
export function EmailNormalizado(): PropertyDecorator {
  return Transform(({ value }) =>
    typeof value === 'string' ? normalizarEmail(value) : value,
  );
}
