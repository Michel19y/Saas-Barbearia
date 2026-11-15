import {
  type ConfigExpediente,
  type Semana,
  SEMANA_PADRAO,
  aplicarMudanca,
  cabeNoExpediente,
  horaDeMinutos,
  instante,
  janelaDaBarbearia,
  janelaDoProfissional,
  minutos,
  semanaValida,
} from './expediente.js';

// 10/12/2026 é uma quinta-feira (dia 4); 13/12/2026 é domingo (dia 0)
const QUINTA = '2026-12-10';
const DOMINGO = '2026-12-13';
const QUINTA_FEIRA = 4;
const DOMINGO_INDICE = 0;

/** Seg–sáb 09:00–19:00, domingo fechado. */
const SEMANA_DA_BARBEARIA: Semana = SEMANA_PADRAO.map((_, dia) => ({
  aberto: dia !== DOMINGO_INDICE,
  inicio: '09:00',
  fim: '19:00',
}));

const config = (parcial: Partial<ConfigExpediente> = {}): ConfigExpediente => ({
  barbearia: SEMANA_DA_BARBEARIA,
  profissionais: {},
  excecoes: [],
  ...parcial,
});

/** "09:00–19:00" ou "fechado", para ler os testes como o dono lê a agenda. */
const texto = (j: ReturnType<typeof janelaDaBarbearia>) =>
  j ? `${horaDeMinutos(j.inicioMin)}–${horaDeMinutos(j.fimMin)}` : 'fechado';

describe('expediente da barbearia', () => {
  it('sem configuração vale o padrão de antes: 09:00–21:00 todo dia', () => {
    expect(texto(janelaDaBarbearia(config({ barbearia: null }), DOMINGO))).toBe('09:00–21:00');
  });

  it('segue a semana: quinta aberta, domingo fechado', () => {
    expect(texto(janelaDaBarbearia(config(), QUINTA))).toBe('09:00–19:00');
    expect(texto(janelaDaBarbearia(config(), DOMINGO))).toBe('fechado');
  });

  it('exceção do dia vence a semana: "dia 10 não abro" e "dia 10 só 14h–18h"', () => {
    const fechado = config({ excecoes: [{ profissionalId: null, data: QUINTA, fechado: true, inicio: null, fim: null }] });
    const meioPeriodo = config({
      excecoes: [{ profissionalId: null, data: QUINTA, fechado: false, inicio: '14:00', fim: '18:00' }],
    });
    expect(texto(janelaDaBarbearia(fechado, QUINTA))).toBe('fechado');
    expect(texto(janelaDaBarbearia(meioPeriodo, QUINTA))).toBe('14:00–18:00');
  });

  it('exceção pode abrir um dia que normalmente é fechado', () => {
    const domingoEspecial = config({
      excecoes: [{ profissionalId: null, data: DOMINGO, fechado: false, inicio: '10:00', fim: '13:00' }],
    });
    expect(texto(janelaDaBarbearia(domingoEspecial, DOMINGO))).toBe('10:00–13:00');
  });
});

describe('expediente do profissional', () => {
  it('sem nada próprio, segue a barbearia', () => {
    expect(texto(janelaDoProfissional(config(), 'ana', QUINTA))).toBe('09:00–19:00');
  });

  it('folga só dele: "dia 10 o fulaninho não trabalha", os outros continuam', () => {
    const c = config({ excecoes: [{ profissionalId: 'ana', data: QUINTA, fechado: true, inicio: null, fim: null }] });
    expect(texto(janelaDoProfissional(c, 'ana', QUINTA))).toBe('fechado');
    expect(texto(janelaDoProfissional(c, 'bruno', QUINTA))).toBe('09:00–19:00');
  });

  it('barbearia fechada fecha todo mundo, mesmo quem tem horário próprio', () => {
    const c = config({
      profissionais: { ana: SEMANA_PADRAO },
      excecoes: [{ profissionalId: null, data: QUINTA, fechado: true, inicio: null, fim: null }],
    });
    expect(texto(janelaDoProfissional(c, 'ana', QUINTA))).toBe('fechado');
  });

  it('o horário dele é recortado pelo da barbearia', () => {
    const semanaDaAna = SEMANA_PADRAO.map(() => ({ aberto: true, inicio: '07:00', fim: '15:00' }));
    expect(texto(janelaDoProfissional(config({ profissionais: { ana: semanaDaAna } }), 'ana', QUINTA))).toBe(
      '09:00–15:00',
    );
  });

  it('exceção dele também é recortada: barbearia 14h–18h, ele 10h–16h → 14h–16h', () => {
    const c = config({
      excecoes: [
        { profissionalId: null, data: QUINTA, fechado: false, inicio: '14:00', fim: '18:00' },
        { profissionalId: 'ana', data: QUINTA, fechado: false, inicio: '10:00', fim: '16:00' },
      ],
    });
    expect(texto(janelaDoProfissional(c, 'ana', QUINTA))).toBe('14:00–16:00');
  });
});

describe('cabeNoExpediente (horário de Brasília)', () => {
  const c = config({ excecoes: [{ profissionalId: null, data: QUINTA, fechado: false, inicio: '14:00', fim: '18:00' }] });
  const de = (inicio: string, fim: string) => [new Date(`${QUINTA}T${inicio}:00-03:00`), new Date(`${QUINTA}T${fim}:00-03:00`)] as const;

  it.each([
    ['14:00', '14:30', true],
    ['17:30', '18:00', true],
    ['13:30', '14:30', false],
    ['17:45', '18:15', false],
    ['10:00', '10:30', false],
  ])('%s–%s cabe? %s', (inicio, fim, esperado) => {
    expect(cabeNoExpediente(c, 'ana', ...de(inicio, fim))).toBe(esperado);
  });

  it('instante() monta a hora no fuso da barbearia', () => {
    expect(instante(QUINTA, minutos('14:00')).toISOString()).toBe('2026-12-10T17:00:00.000Z');
  });
});

describe('aplicarMudanca', () => {
  it('nova exceção substitui a do mesmo dia e mesmo dono da regra', () => {
    const c = config({ excecoes: [{ profissionalId: 'ana', data: QUINTA, fechado: true, inicio: null, fim: null }] });
    const depois = aplicarMudanca(c, {
      tipo: 'excecao',
      profissionalId: 'ana',
      data: QUINTA,
      fechado: false,
      inicio: '10:00',
      fim: '12:00',
    });
    expect(depois.excecoes).toHaveLength(1);
    expect(texto(janelaDoProfissional(depois, 'ana', QUINTA))).toBe('10:00–12:00');
  });

  it('semana null no profissional volta a seguir a barbearia', () => {
    const c = config({ profissionais: { ana: SEMANA_PADRAO.map(() => ({ aberto: false, inicio: '09:00', fim: '10:00' })) } });
    const depois = aplicarMudanca(c, { tipo: 'semana', profissionalId: 'ana', semana: null });
    expect(texto(janelaDoProfissional(depois, 'ana', QUINTA))).toBe('09:00–19:00');
  });

  it('remover exceção desfaz a mudança do dia', () => {
    const c = config({ excecoes: [{ id: 'e1', profissionalId: null, data: QUINTA, fechado: true, inicio: null, fim: null }] });
    expect(texto(janelaDaBarbearia(aplicarMudanca(c, { tipo: 'remover-excecao', excecaoId: 'e1' }), QUINTA))).toBe(
      '09:00–19:00',
    );
  });
});

describe('semanaValida', () => {
  it('aceita 7 dias bem formados', () => {
    expect(semanaValida(SEMANA_DA_BARBEARIA)).toEqual(SEMANA_DA_BARBEARIA);
  });

  it.each([
    ['menos de 7 dias', SEMANA_DA_BARBEARIA.slice(1)],
    ['início depois do fim', SEMANA_DA_BARBEARIA.map((d, i) => (i === QUINTA_FEIRA ? { ...d, inicio: '20:00' } : d))],
    ['hora mal escrita', SEMANA_DA_BARBEARIA.map((d, i) => (i === QUINTA_FEIRA ? { ...d, fim: '7pm' } : d))],
    ['não é lista', { segunda: '9-19' }],
  ])('recusa %s', (_, valor) => {
    expect(semanaValida(valor)).toBeNull();
  });
});
