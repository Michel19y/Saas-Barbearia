import { ConflictException } from '@nestjs/common';

/**
 * Trava do banco (migration 20261115200000_trava_agendamento_sobreposto): o mesmo profissional
 * não pode ter dois agendamentos não cancelados sobrepostos. Ela pega o caso em que dois clientes
 * confirmam o mesmo horário ao mesmo tempo e os dois passam pela conferência do app.
 */
const NOME_DA_TRAVA = 'agendamentos_sem_sobreposicao';
/** Código do Postgres para "violação de restrição de exclusão". */
const CODIGO_EXCLUSAO = '23P01';

export const MENSAGEM_HORARIO_OCUPADO = 'Esse horário acabou de ser ocupado, escolha outro';

/**
 * O adaptador do Prisma não tem um tipo próprio para esse erro: repassa o código e a mensagem
 * do Postgres (em message, meta ou cause, conforme a versão). Procura pelos dois sinais.
 */
export function ehHorarioSobreposto(erro: unknown): boolean {
  const e = erro as { message?: unknown; meta?: unknown; cause?: unknown } | null;
  const mensagem = typeof e?.message === 'string' ? e.message : '';
  const texto = [mensagem, JSON.stringify(e?.meta ?? {}), JSON.stringify(e?.cause ?? {})].join(' ');
  return texto.includes(NOME_DA_TRAVA) || texto.includes(CODIGO_EXCLUSAO);
}

/** Roda a gravação; se a trava recusar por sobreposição, responde 409 com mensagem clara. */
export async function comTravaDeHorario<T>(gravar: () => Promise<T>): Promise<T> {
  try {
    return await gravar();
  } catch (erro) {
    if (ehHorarioSobreposto(erro)) throw new ConflictException(MENSAGEM_HORARIO_OCUPADO);
    throw erro;
  }
}
