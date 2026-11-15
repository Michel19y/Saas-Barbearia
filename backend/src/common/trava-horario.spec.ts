import { ConflictException } from '@nestjs/common';
import { comTravaDeHorario, ehHorarioSobreposto, MENSAGEM_HORARIO_OCUPADO } from './trava-horario.js';

// Mensagem real do Postgres, conferida contra a migration num Postgres 17
const MENSAGEM_POSTGRES = 'conflicting key value violates exclusion constraint "agendamentos_sem_sobreposicao"';

describe('trava de horário', () => {
  it.each([
    ['na mensagem', { message: `Invalid prisma.agendamento.create() invocation: ${MENSAGEM_POSTGRES}` }],
    ['no meta do adaptador', { code: 'P2010', meta: { driverAdapterError: { cause: { kind: 'postgres', code: '23P01' } } } }],
    ['na causa', { message: 'erro', cause: { originalCode: '23P01', originalMessage: MENSAGEM_POSTGRES } }],
  ])('reconhece a recusa da trava %s', (_, erro) => {
    expect(ehHorarioSobreposto(erro)).toBe(true);
  });

  it('não confunde com outros erros', () => {
    expect(ehHorarioSobreposto({ code: 'P2002', message: 'Unique constraint failed on email' })).toBe(false);
    expect(ehHorarioSobreposto(null)).toBe(false);
  });

  it('transforma a recusa em 409 com mensagem para o cliente', async () => {
    await expect(comTravaDeHorario(() => Promise.reject({ message: MENSAGEM_POSTGRES }))).rejects.toThrow(
      new ConflictException(MENSAGEM_HORARIO_OCUPADO),
    );
  });

  it('repassa outros erros sem mascarar e devolve o resultado quando dá certo', async () => {
    const falha = new Error('banco fora do ar');
    await expect(comTravaDeHorario(() => Promise.reject(falha))).rejects.toBe(falha);
    await expect(comTravaDeHorario(() => Promise.resolve('gravado'))).resolves.toBe('gravado');
  });
});
