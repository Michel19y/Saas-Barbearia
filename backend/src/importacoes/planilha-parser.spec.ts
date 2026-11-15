import {
  analisarPlanilha,
  mapearFormaPagamento,
  parseDataAba,
  parseHora,
  parseValorParaCentavos,
} from './planilha-parser.js';

// "Hoje" fixo para as regras de ano: 14/11/2026 (horário de Brasília)
const HOJE = new Date('2026-11-14T15:00:00-03:00');
const CABECALHO = ['HORARIO', 'TIPO DO SERVIÇO', 'CLIENTE', 'ENTRADA', 'FP'];
const ABA = '10-11-2026';
const CENTAVOS = 100;
const DIGITOS = 2;
/** "12:30" (UTC) de um instante, para comparar horários gravados. */
const horaUtc = (d: Date) => d.toISOString().split('T')[1].slice(0, '12:00'.length);
const doisDigitos = (n: number) => String(n).padStart(DIGITOS, '0');
/** Centavos como o dono lê: 4500 vira "45,00". */
const reais = (centavos: number | null | undefined) =>
  centavos === null || centavos === undefined ? null : (centavos / CENTAVOS).toFixed(DIGITOS).replace('.', ',');

const analisar = (linhas: string[][], titulo = ABA) => analisarPlanilha([{ titulo, linhas }], HOJE);
const resumo = (linhas: string[][]) =>
  analisar(linhas).linhas.map((l) => `${horaUtc(l.dataHora)} ${l.cliente} | ${l.servico} | ${reais(l.valorCentavos)}`);

describe('analisarPlanilha: formato padrão', () => {
  it('lê blocos lado a lado, com o profissional na linha de cima, e grava 09:00 de Brasília', () => {
    const a = analisar([
      ['Henrique', '', '', '', '', '', 'Carlos'],
      [...CABECALHO, '', ...CABECALHO],
      ['09:00', 'Corte', 'João Silva', '45,00', 'P', '', '09:00', 'Corte', 'Marcos Dias', '45', 'CD'],
      ['TOTAL', '', '', '45,00', '', '', 'TOTAL', '', '', '45', ''],
    ]);

    expect(a.problemas).toEqual([]);
    expect(a.linhas.map((l) => [l.profissional, l.cliente, l.formaPagamento])).toEqual([
      ['Henrique', 'João Silva', 'Pix'],
      ['Carlos', 'Marcos Dias', 'Cartão Débito'],
    ]);
    // 09:00 em Brasília = 12:00 UTC, igual ao que já está no banco
    expect(a.linhas[0].dataHora.toISOString()).toBe('2026-11-10T12:00:00.000Z');
    expect(a.abas[0]).toMatchObject({ data: '2026-11-10', importada: true, problemas: 0 });
    expect(a.abas[0].atendimentos).toBe(a.linhas.length);
  });

  it('separa blocos colados (sem coluna vazia entre eles) pela coluna de horário', () => {
    const a = analisar([
      ['Ana', '', '', '', '', 'Bia'],
      [...CABECALHO, ...CABECALHO],
      ['09:00', 'Corte', 'João', '45', 'P', '10:00', 'Barba', 'Pedro', '30', 'D'],
    ]);
    expect(a.linhas.map((l) => `${l.profissional}:${l.cliente}`)).toEqual(['Ana:João', 'Bia:Pedro']);
  });
});

describe('analisarPlanilha: fora do padrão', () => {
  it('colunas em outra ordem são lidas pelo nome (não troca cliente por serviço)', () => {
    const a = analisar([
      ['Ana'],
      ['CLIENTE', 'FORMA DE PAGAMENTO', 'Horário', 'VALOR', 'SERVIÇO'],
      ['João', 'pix', '09:00', 'R$ 45,00', 'Corte'],
    ]);
    expect(a.linhas[0]).toMatchObject({ cliente: 'João', servico: 'Corte', formaPagamento: 'Pix' });
    expect(reais(a.linhas[0].valorCentavos)).toBe('45,00');
    expect(a.abas[0].profissionais[0].colunas).toEqual({
      cliente: 'CLIENTE',
      pagamento: 'FORMA DE PAGAMENTO',
      hora: 'Horário',
      valor: 'VALOR',
      servico: 'SERVIÇO',
    });
  });

  it('aceita sinônimos: HORA, NOME, PREÇO, PGTO', () => {
    const a = analisar([['Ana'], ['HORA', 'NOME', 'PREÇO', 'PGTO'], ['9h', 'João', '45', 'dinheiro']]);
    expect(a.linhas[0]).toMatchObject({ cliente: 'João', servico: 'Serviço', formaPagamento: 'Dinheiro' });
    expect(reais(a.linhas[0].valorCentavos)).toBe('45,00');
  });

  it('não para em linha em branco nem em "9h30": todos os atendimentos entram', () => {
    expect(
      resumo([
        ['Ana'],
        CABECALHO,
        ['09:00', 'Corte', 'João', '45', 'P'],
        ['', '', '', '', ''],
        ['9h30', 'Barba', 'Pedro', '30', 'D'],
        ['10.00', 'Corte', 'Lucas', '45', 'P'],
      ]),
    ).toEqual(['12:00 João | Corte | 45,00', '12:30 Pedro | Barba | 30,00', '13:00 Lucas | Corte | 45,00']);
  });

  it('linha com problema vira aviso com o número da linha e não é gravada', () => {
    const a = analisar([
      ['Ana'],
      CABECALHO,
      ['09:00', 'Corte', 'João', 'quarenta', 'P'],
      ['manhã', 'Corte', 'Pedro', '45', 'P'],
      ['', 'Corte', 'Lucas', '45', 'P'],
      ['11:00', 'Barba', '', '30', 'D'],
      ['12:00', 'Corte', 'Rafa', '45', 'P'],
    ]);

    expect(a.linhas.map((l) => l.cliente)).toEqual(['Rafa']);
    expect(a.problemas.map((p) => `linha ${p.linhaPlanilha}: ${p.motivo}`)).toEqual([
      'linha 3: valor "quarenta" não reconhecido',
      'linha 4: horário "manhã" não reconhecido',
      'linha 5: sem horário',
      'linha 6: tem valor mas está sem o nome do cliente',
    ]);
    expect(a.problemas[0]).toMatchObject({ aba: ABA, profissional: 'Ana' });
  });

  it('linha de TOTAL é ignorada mesmo na coluna de cliente, e serviço sem cliente nem valor é horário vago', () => {
    const a = analisar([
      ['Ana'],
      ['CLIENTE', 'HORA', 'SERVIÇO', 'VALOR'],
      ['João', '09:00', 'Corte', '45'],
      ['', '15:00', 'Corte', ''],
      ['Total', '', '', '45'],
    ]);
    expect(a.problemas).toEqual([]);
    expect(a.linhas.map((l) => l.cliente)).toEqual(['João']);
  });

  it('horário vago e valor em branco não são problema', () => {
    const a = analisar([['Ana'], CABECALHO, ['09:00', '', '', '', ''], ['10:00', 'Corte', 'João', '', '']]);
    expect(a.problemas).toEqual([]);
    expect(a.linhas[0]).toMatchObject({ cliente: 'João', valorCentavos: 0, formaPagamento: 'Não informado' });
  });

  it('aba sem cabeçalho reconhecível é ignorada e diz quais nomes servem', () => {
    const a = analisar([['Ana'], ['QUANDO', 'QUEM', 'QUANTO'], ['09:00', 'João', '45']]);
    expect(a.abas[0].importada).toBe(false);
    expect(a.abas[0].motivo).toContain('HORARIO, HORA');
    expect(a.abas[0].motivo).toContain('CLIENTE');
  });

  it('bloco sem coluna de cliente é avisado e os outros blocos continuam', () => {
    const a = analisar([
      ['Ana', '', '', 'Bia'],
      ['HORA', 'CLIENTE', '', 'HORA', 'SERVIÇO'],
      ['09:00', 'João', '', '10:00', 'Corte'],
    ]);
    expect(a.linhas.map((l) => l.cliente)).toEqual(['João']);
    expect(a.abas[0].avisos[0]).toContain('bloco de "Bia" ignorado: faltou a coluna de cliente');
  });

  it('aba sem data no nome é ignorada com o motivo', () => {
    const a = analisar([['Ana'], CABECALHO, ['09:00', 'Corte', 'João', '45', 'P']], 'Resumo');
    expect(a.abas[0]).toMatchObject({ importada: false, data: null });
    expect(a.linhas).toEqual([]);
  });
});

describe('parseDataAba', () => {
  it.each([
    ['10-11-2026', '2026-11-10'],
    ['10/11/2026', '2026-11-10'],
    ['10.11.2026', '2026-11-10'],
    ['10/11/26', '2026-11-10'],
    ['2026-11-10', '2026-11-10'],
    ['Segunda 10/11', '2026-11-10'],
    ['10 nov', '2026-11-10'],
    ['10 de novembro de 2026', '2026-11-10'],
  ])('"%s" vira %s', (titulo, esperado) => {
    const d = parseDataAba(titulo, HOJE);
    expect(d && `${d.ano}-${doisDigitos(d.mes)}-${doisDigitos(d.dia)}`).toBe(esperado);
  });

  it('sem ano e no futuro: assume o ano anterior (histórico é passado)', () => {
    const d = parseDataAba('28/12', HOJE);
    expect(d && `${d.ano}-${doisDigitos(d.mes)}-${doisDigitos(d.dia)}`).toBe('2025-12-28');
    expect(d?.anoAssumido).toBe(true);
  });

  it.each(['Resumo', '31/02/2026', '10/13', '110/11'])('recusa "%s"', (titulo) => {
    expect(parseDataAba(titulo, HOJE)).toBeNull();
  });
});

describe('parseHora', () => {
  it.each([
    ['09:00', '09:00'],
    ['9:00', '09:00'],
    ['9h', '09:00'],
    ['9h30', '09:30'],
    ['09.00', '09:00'],
    ['09:00:00', '09:00'],
    ['9:00 PM', '21:00'],
  ])('"%s" → %s', (texto, esperado) => {
    const h = parseHora(texto);
    expect(h && `${doisDigitos(h.hora)}:${doisDigitos(h.minuto)}`).toBe(esperado);
  });

  it.each(['TOTAL', 'manhã', '25:00', '9:75', ''])('recusa "%s"', (texto) => {
    expect(parseHora(texto)).toBeNull();
  });
});

describe('parseValorParaCentavos', () => {
  it.each([
    ['45', '45,00'],
    ['45,00', '45,00'],
    ['R$ 45,00', '45,00'],
    ['45 reais', '45,00'],
    ['45.5', '45,50'],
    ['1.234,50', '1234,50'],
    ['1.234', '1234,00'],
  ])('"%s" → R$ %s', (texto, esperado) => {
    expect(reais(parseValorParaCentavos(texto))).toBe(esperado);
  });

  it.each(['quarenta', 'cortesia', 'quarenta e 5', ''])('"%s" não é valor', (texto) => {
    expect(parseValorParaCentavos(texto)).toBeNull();
  });
});

describe('mapearFormaPagamento', () => {
  it.each([
    ['P', 'Pix'],
    ['pix', 'Pix'],
    ['C-D', 'Cartão Débito'],
    ['Débito', 'Cartão Débito'],
    ['cartão crédito', 'Cartão Crédito'],
    ['din', 'Dinheiro'],
    ['VR', 'VR'],
    ['', 'Não informado'],
  ])('"%s" → %s', (codigo, esperado) => {
    expect(mapearFormaPagamento(codigo)).toBe(esperado);
  });
});
