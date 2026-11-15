import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAtendimentoDto } from './update-atendimento.dto.js';

const NEGATIVO = -1;
const UM_ZERO_A_MAIS = 100_000_000;

const mensagens = async (corpo: object) =>
  (await validate(plainToInstance(UpdateAtendimentoDto, corpo))).flatMap((e) => Object.values(e.constraints ?? {}));

describe('UpdateAtendimentoDto', () => {
  it('aceita uma correção completa com fuso', async () => {
    expect(
      await mensagens({
        data: '2026-11-10T10:30:00-03:00',
        clienteId: null,
        clienteNome: 'Pedro',
        servicoId: 's1',
        profissionalNome: '',
        valorCentavos: 0,
        formaPagamento: 'Pix',
      }),
    ).toEqual([]);
  });

  it.each([
    [{ data: '10/11/2026' }, 'Data e hora inválidas'],
    [{ valorCentavos: NEGATIVO }, 'O valor não pode ser negativo'],
    [{ valorCentavos: UM_ZERO_A_MAIS }, 'Valor alto demais; confira os zeros'],
    [{ valorCentavos: '45,00' }, 'Valor inválido'],
    [{ formaPagamento: '' }, 'Informe a forma de pagamento'],
  ])('recusa %j', async (corpo, mensagem) => {
    expect(await mensagens(corpo)).toContain(mensagem);
  });
});
