/**
 * Análise da planilha de histórico de atendimentos.
 *
 * Formato esperado: uma aba por dia (a data fica no nome da aba) e, dentro dela, um
 * bloco de colunas por profissional, lado a lado. O nome do profissional fica na linha
 * acima do cabeçalho. As colunas são achadas pelo NOME do cabeçalho (com sinônimos), em
 * qualquer ordem, então a planilha não precisa seguir uma posição fixa.
 *
 * A análise é pura (não toca no banco): a prévia e a importação usam o mesmo resultado,
 * então o que a prévia mostra é exatamente o que será gravado.
 */

export type Aba = { titulo: string; linhas: string[][] };
export type Campo = 'hora' | 'servico' | 'cliente' | 'valor' | 'pagamento';

const SINONIMOS: Record<Campo, readonly string[]> = {
  hora: ['horario', 'hora', 'hr', 'horas'],
  servico: ['tipo do servico', 'tipo de servico', 'servico', 'servicos', 'tipo', 'procedimento'],
  cliente: ['cliente', 'clientes', 'nome', 'nome do cliente'],
  valor: ['entrada', 'valor', 'valor pago', 'preco', 'r$'],
  pagamento: ['fp', 'forma de pagamento', 'forma pagamento', 'pagamento', 'forma', 'pgto'],
};
const CAMPOS = Object.keys(SINONIMOS) as Campo[];

/** Nomes aceitos, para as mensagens ("HORARIO, HORA, HR, HORAS"). */
export const NOMES_ACEITOS: Record<Campo, string> = Object.fromEntries(
  CAMPOS.map((campo) => [campo, SINONIMOS[campo].map((s) => s.toUpperCase()).join(', ')]),
) as Record<Campo, string>;

const SEM_PROFISSIONAL = 'Profissional não identificado';
const SERVICO_PADRAO = 'Serviço';
const SEM_PAGAMENTO = 'Não informado';
/** Linhas de soma no fim do dia, que não são atendimento. */
const PALAVRAS_DE_TOTAL = new Set(['total', 'totais', 'subtotal', 'soma', 'total do dia']);
/** Fuso das barbearias (Brasil sem horário de verão desde 2019). */
const FUSO = '-03:00';
const HORAS_NO_DIA = 24;
const MINUTOS_NA_HORA = 60;
const MEIO_DIA = 12;
const CENTAVOS = 100;
const SECULO = 2000;
const DIGITOS_ANO_CURTO = 2;
const DIGITOS_DIA_MES = 2;
/** Número da linha como aparece na planilha (o índice começa em 0, a planilha em 1). */
const numeroDaLinha = (indice: number) => indice + 1;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// ---------- textos ----------

/** Minúsculas, sem acento, espaços simples e sem ":" ou "." no fim ("Horário:" vira "horario"). */
export function normalizarTexto(texto: string): string {
  return (
    texto
      .normalize('NFD')
      // Acentos separados pelo NFD: "á" vira "a" + acento, e o acento sai.
      // https://regex101.com/?flavor=javascript&flags=g&regex=%5B%5Cu0300-%5Cu036f%5D
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      // Espaços repetidos viram um: "tipo   do" vira "tipo do".
      // https://regex101.com/?flavor=javascript&flags=g&regex=%5Cs%2B&testString=tipo%20%20%20do
      .replace(/\s+/g, ' ')
      .trim()
      // Pontuação no fim: "horario:" e "valor." perdem o ":" e o "."; "r$" fica.
      // https://regex101.com/?flavor=javascript&regex=%5B%3A.%5D%2B%24&testString=horario%3A
      .replace(/[:.]+$/, '')
  );
}

function campoDoCabecalho(texto: string): Campo | undefined {
  const normalizado = normalizarTexto(texto);
  return CAMPOS.find((campo) => SINONIMOS[campo].includes(normalizado));
}

const celula = (linha: readonly string[] | undefined, coluna: number | undefined): string =>
  coluna === undefined ? '' : String(linha?.[coluna] ?? '').trim();

// ---------- hora ----------

/**
 * Hora do atendimento. Aceita "09:00", "9:00", "09.00", "9h", "9h30", "09:00:00", "9" e "9:00 PM".
 * Recusa "TOTAL", "manhã" e "25:00".
 * https://regex101.com/?flavor=javascript&regex=%5E(%5Cd%7B1%2C2%7D)(%3F%3A%5B%3Ah.%5D(%5Cd%7B2%7D))%3F(%3F%3A%3A%5Cd%7B2%7D)%3F(%3F%3Ahs%3F)%3F(am%7Cpm)%3F%24&testString=09%3A00%0A9h30%0A9h%0A09.00%0A09%3A00%3A00%0A9%3A00pm%0Atotal
 */
const FORMATO_HORA = /^(\d{1,2})(?:[:h.](\d{2}))?(?::\d{2})?(?:hs?)?(am|pm)?$/;

export function parseHora(texto: string): { hora: number; minuto: number } | null {
  // Tira espaços internos: "9 h 30" e "9:00 PM" ficam "9h30" e "9:00pm".
  // https://regex101.com/?flavor=javascript&flags=g&regex=%5Cs&testString=9%3A00%20PM
  const encontrado = texto.trim().toLowerCase().replace(/\s/g, '').match(FORMATO_HORA);
  if (!encontrado) return null;
  const [, h, m, periodo] = encontrado;
  const ajustePm = periodo === 'pm' && Number(h) < MEIO_DIA ? MEIO_DIA : 0;
  const hora = Number(h) + ajustePm;
  const minuto = Number(m ?? 0);
  if (hora >= HORAS_NO_DIA || minuto >= MINUTOS_NA_HORA) return null;
  return { hora, minuto };
}

// ---------- valor ----------

/**
 * Pontos só como separador de milhar: "1.234" e "12.345.678" (mil, não 1,234).
 * Recusa "45.5" e "1.23" (esses são decimais).
 * https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B1%2C3%7D(%5C.%5Cd%7B3%7D)%2B%24&testString=1.234%0A12.345.678%0A45.5%0A1.23
 */
const SO_MILHAR = /^\d{1,3}(\.\d{3})+$/;

function paraNumeroDecimal(limpo: string): string {
  // Com vírgula, padrão brasileiro: "1.234,50" vira "1234.50".
  if (limpo.includes(',')) return limpo.replaceAll('.', '').replace(',', '.');
  if (SO_MILHAR.test(limpo)) return limpo.replaceAll('.', '');
  return limpo;
}

/**
 * Valor em centavos. "45", "45,00", "R$ 45,00", "45 reais", "1.234,50" e "1.234" funcionam.
 * Texto que não é valor ("quarenta", "cortesia") devolve null, para virar aviso, e não R$ 0.
 */
export function parseValorParaCentavos(valor: string | undefined): number | null {
  if (!valor?.trim()) return null;
  // Tira o símbolo/nome da moeda; se ainda sobrar letra, não é um valor.
  // Aceita "R$ 45" e "45 reais"; sobra letra em "quarenta" e "cortesia".
  // https://regex101.com/?flavor=javascript&flags=g&regex=r%5C%24%7Creais%7Creal%7Crs&testString=r%24%2045%0A45%20reais
  const semMoeda = normalizarTexto(valor).replace(/r\$|reais|real|rs/g, '');
  // Sobrou alguma letra? Em "quarenta" sim; em "45" e "1.234,50" não.
  // https://regex101.com/?flavor=javascript&regex=%5Ba-z%5D&testString=quarenta%0A45
  if (/[a-z]/.test(semMoeda)) return null;
  // Só dígitos, vírgula, ponto e sinal: "R$ 1.234,50" vira "1.234,50".
  // https://regex101.com/?flavor=javascript&flags=g&regex=%5B%5E%5Cd%2C.-%5D&testString=R%24%201.234%2C50
  const limpo = valor.replace(/[^\d,.-]/g, '');
  const numero = Number(paraNumeroDecimal(limpo));
  if (!limpo || Number.isNaN(numero)) return null;
  return Math.round(numero * CENTAVOS);
}

// ---------- forma de pagamento ----------

const FORMAS_PAGAMENTO: Record<string, string> = {
  'c-d': 'Cartão Débito',
  cd: 'Cartão Débito',
  debito: 'Cartão Débito',
  'cartao debito': 'Cartão Débito',
  'c-c': 'Cartão Crédito',
  cc: 'Cartão Crédito',
  credito: 'Cartão Crédito',
  'cartao credito': 'Cartão Crédito',
  d: 'Dinheiro',
  din: 'Dinheiro',
  dinheiro: 'Dinheiro',
  especie: 'Dinheiro',
  p: 'Pix',
  pix: 'Pix',
};

export function mapearFormaPagamento(codigo: string | undefined): string {
  if (!codigo?.trim()) return SEM_PAGAMENTO;
  return FORMAS_PAGAMENTO[normalizarTexto(codigo)] ?? codigo.trim();
}

// ---------- data da aba ----------

export type DataDaAba = { ano: number; mes: number; dia: number; anoAssumido: boolean };

/**
 * Ano-mês-dia: "2026-11-10".
 * https://regex101.com/?flavor=javascript&regex=(%3F%3C!%5Cd)(%5Cd%7B4%7D)-(%5Cd%7B1%2C2%7D)-(%5Cd%7B1%2C2%7D)(%3F!%5Cd)&testString=2026-11-10
 */
const DATA_ISO = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/;
/**
 * Dia/mês com ano opcional, em qualquer parte do nome da aba e com "/", "-" ou ".":
 * "10/11", "10-11-2026", "10.11.2026", "10/11/26", "Segunda 10/11". Não pega "110/11".
 * https://regex101.com/?flavor=javascript&regex=(%3F%3C!%5Cd)(%5Cd%7B1%2C2%7D)%5B.%2F-%5D(%5Cd%7B1%2C2%7D)(%3F%3A%5B.%2F-%5D(%5Cd%7B4%7D%7C%5Cd%7B2%7D))%3F(%3F!%5Cd)&testString=10%2F11%0A10-11-2026%0A10.11.2026%0A10%2F11%2F26%0ASegunda%2010%2F11
 */
const DATA_BR = /(?<!\d)(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}|\d{2}))?(?!\d)/;
/**
 * Dia e mês por extenso: "10 nov", "10 de novembro", "10 nov 2026".
 * https://regex101.com/?flavor=javascript&regex=(%3F%3C!%5Cd)(%5Cd%7B1%2C2%7D)%20%3F(%3F%3Ade%20)%3F(jan%7Cfev%7Cmar%7Cabr%7Cmai%7Cjun%7Cjul%7Cago%7Cset%7Cout%7Cnov%7Cdez)%5Ba-z%5D*(%3F%3A%20%3F(%3F%3Ade%20)%3F(%5Cd%7B4%7D))%3F&testString=10%20nov%0A10%20de%20novembro%0A10%20nov%202026
 */
const DATA_EXTENSO = /(?<!\d)(\d{1,2}) ?(?:de )?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*(?: ?(?:de )?(\d{4}))?/;

function dataValida(ano: number, mes: number, dia: number): boolean {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function anoCompleto(ano: string): number {
  const numero = Number(ano);
  return ano.length === DIGITOS_ANO_CURTO ? SECULO + numero : numero;
}

function partesDaData(titulo: string): { ano?: number; mes: number; dia: number } | null {
  const iso = titulo.match(DATA_ISO);
  if (iso) return { ano: Number(iso[1]), mes: Number(iso[2]), dia: Number(iso[3]) };
  const br = titulo.match(DATA_BR);
  if (br) return { dia: Number(br[1]), mes: Number(br[2]), ano: br[3] ? anoCompleto(br[3]) : undefined };
  const extenso = titulo.match(DATA_EXTENSO);
  if (extenso) {
    return {
      dia: Number(extenso[1]),
      mes: MESES.indexOf(extenso[2]) + 1,
      ano: extenso[3] ? Number(extenso[3]) : undefined,
    };
  }
  return null;
}

/**
 * Data do dia pelo nome da aba. Sem ano, usa o ano de `hoje`, ou o anterior se a data
 * cairia no futuro (histórico é sempre passado: "28/12" importado em janeiro é do ano anterior).
 */
export function parseDataAba(titulo: string, hoje = new Date()): DataDaAba | null {
  const partes = partesDaData(normalizarTexto(titulo));
  if (!partes) return null;
  const { mes, dia } = partes;
  const anoAtual = hoje.getFullYear();
  const futura = new Date(anoAtual, mes - 1, dia) > hoje;
  const ano = partes.ano ?? (futura ? anoAtual - 1 : anoAtual);
  if (!dataValida(ano, mes, dia)) return null;
  return { ano, mes, dia, anoAssumido: partes.ano === undefined };
}

const doisDigitos = (n: number) => String(n).padStart(DIGITOS_DIA_MES, '0');

export function dataIso(data: DataDaAba): string {
  return `${data.ano}-${doisDigitos(data.mes)}-${doisDigitos(data.dia)}`;
}

function instante(data: DataDaAba, hora: number, minuto: number): Date {
  return new Date(`${dataIso(data)}T${doisDigitos(hora)}:${doisDigitos(minuto)}:00${FUSO}`);
}

// ---------- cabeçalho e blocos ----------

type Bloco = {
  profissional: string;
  colunas: Partial<Record<Campo, number>>;
  rotulos: Partial<Record<Campo, string>>;
  ignoradas: string[];
};

/** Índice da primeira linha que tem uma coluna de hora e uma de cliente. */
function linhaDoCabecalho(linhas: string[][]): number {
  return linhas.findIndex((linha) => {
    const campos = Array.from(linha ?? [], (c) => campoDoCabecalho(String(c ?? '')));
    return campos.includes('hora') && campos.includes('cliente');
  });
}

/** Grupos de colunas preenchidas e vizinhas: ["A","B","","C"] dá [[0,1],[3,3]]. */
function trechosContiguos(cabecalho: string[]): Array<[number, number]> {
  return cabecalho.reduce<Array<[number, number]>>((trechos, texto, i) => {
    if (!String(texto ?? '').trim()) return trechos;
    const ultimo = trechos.at(-1);
    if (ultimo && ultimo[1] === i - 1) return [...trechos.slice(0, -1), [ultimo[0], i]];
    return [...trechos, [i, i]];
  }, []);
}

/**
 * Cada trecho vira um bloco; se o trecho tiver várias colunas de hora (blocos colados,
 * sem coluna vazia entre eles), corta antes de cada hora a partir da segunda.
 */
function intervalosDosBlocos(cabecalho: string[]): Array<[number, number]> {
  return trechosContiguos(cabecalho).flatMap(([inicio, fim]) => {
    const horas = Array.from({ length: fim - inicio + 1 }, (_, k) => inicio + k).filter(
      (i) => campoDoCabecalho(cabecalho[i]) === 'hora',
    );
    const inicios = [inicio, ...horas.slice(1)];
    return inicios.map((ini, k): [number, number] => [ini, (inicios[k + 1] ?? fim + 1) - 1]);
  });
}

function montarBloco(cabecalho: string[], acima: string[] | undefined, [ini, fim]: [number, number]): Bloco {
  const indices = Array.from({ length: fim - ini + 1 }, (_, k) => ini + k);
  const reconhecidas = indices
    .map((i) => ({ i, texto: celula(cabecalho, i), campo: campoDoCabecalho(celula(cabecalho, i)) }))
    .filter((c) => c.texto);
  const primeiraDeCada = reconhecidas.filter(
    (c, k) => c.campo && reconhecidas.findIndex((o) => o.campo === c.campo) === k,
  );
  return {
    profissional: indices.map((i) => celula(acima, i)).find(Boolean) ?? SEM_PROFISSIONAL,
    colunas: Object.fromEntries(primeiraDeCada.map((c) => [c.campo, c.i])),
    rotulos: Object.fromEntries(primeiraDeCada.map((c) => [c.campo, c.texto])),
    ignoradas: reconhecidas.filter((c) => !primeiraDeCada.includes(c)).map((c) => c.texto),
  };
}

// ---------- linhas ----------

export type LinhaImportavel = {
  aba: string;
  linhaPlanilha: number;
  profissional: string;
  cliente: string;
  servico: string;
  valorCentavos: number;
  formaPagamento: string;
  dataHora: Date;
};

export type Problema = { aba: string; linhaPlanilha: number; profissional: string; motivo: string };

type Resultado =
  | { tipo: 'ok'; linha: LinhaImportavel }
  | { tipo: 'problema'; problema: Problema }
  | { tipo: 'ignorar' };

function analisarLinha(
  aba: string,
  data: DataDaAba,
  bloco: Bloco,
  linha: string[] | undefined,
  linhaPlanilha: number,
): Resultado {
  const valorDe = (campo: Campo) => celula(linha, bloco.colunas[campo]);
  const [horaTexto, cliente, servico, valorTexto] = (['hora', 'cliente', 'servico', 'valor'] as const).map(valorDe);
  const hora = parseHora(horaTexto);
  const problema = (motivo: string): Resultado => ({
    tipo: 'problema',
    problema: { aba, linhaPlanilha, profissional: bloco.profissional, motivo },
  });

  // Linha de total, em qualquer coluna ("TOTAL | | | 210,50" ou "| TOTAL | 80"): não é atendimento
  if ([horaTexto, cliente].some((t) => PALAVRAS_DE_TOTAL.has(normalizarTexto(t)))) return { tipo: 'ignorar' };
  // Linha vazia ou horário vago (ainda que com o serviço pré-preenchido, como "15:00 | Corte")
  if (!cliente && (!hora || !valorTexto)) return { tipo: 'ignorar' };
  // Valor sem cliente: é dinheiro que sumiria do Financeiro, então avisa
  if (!cliente) return problema('tem valor mas está sem o nome do cliente');
  if (!hora) return problema(horaTexto ? `horário "${horaTexto}" não reconhecido` : 'sem horário');

  const valorCentavos = valorTexto ? parseValorParaCentavos(valorTexto) : 0;
  if (valorCentavos === null) return problema(`valor "${valorTexto}" não reconhecido`);

  return {
    tipo: 'ok',
    linha: {
      aba,
      linhaPlanilha,
      profissional: bloco.profissional,
      cliente,
      servico: servico || SERVICO_PADRAO,
      valorCentavos,
      formaPagamento: mapearFormaPagamento(valorDe('pagamento')),
      dataHora: instante(data, hora.hora, hora.minuto),
    },
  };
}

// ---------- aba e planilha ----------

export type ResumoAba = {
  titulo: string;
  data: string | null;
  importada: boolean;
  motivo?: string;
  avisos: string[];
  atendimentos: number;
  problemas: number;
  profissionais: Array<{
    nome: string;
    atendimentos: number;
    colunas: Partial<Record<Campo, string>>;
  }>;
};

export type AnalisePlanilha = {
  abas: ResumoAba[];
  linhas: LinhaImportavel[];
  problemas: Problema[];
};

const MOTIVO_SEM_DATA =
  'não achei a data no nome da aba (use, por exemplo, 10-11-2026 ou 10/11)';
const MOTIVO_SEM_CABECALHO =
  `não achei o cabeçalho: a aba precisa de uma coluna de horário (${NOMES_ACEITOS.hora}) ` +
  `e uma de cliente (${NOMES_ACEITOS.cliente})`;

function analisarAba(aba: Aba, hoje: Date): { resumo: ResumoAba; linhas: LinhaImportavel[]; problemas: Problema[] } {
  const base = { titulo: aba.titulo, avisos: [] as string[], atendimentos: 0, problemas: 0, profissionais: [] };
  const data = parseDataAba(aba.titulo, hoje);
  if (!data) {
    return { resumo: { ...base, data: null, importada: false, motivo: MOTIVO_SEM_DATA }, linhas: [], problemas: [] };
  }
  const indiceCabecalho = linhaDoCabecalho(aba.linhas);
  if (indiceCabecalho === -1) {
    return {
      resumo: { ...base, data: dataIso(data), importada: false, motivo: MOTIVO_SEM_CABECALHO },
      linhas: [],
      problemas: [],
    };
  }

  const cabecalho = Array.from(aba.linhas[indiceCabecalho], (c) => String(c ?? ''));
  const blocos = intervalosDosBlocos(cabecalho).map((intervalo) =>
    montarBloco(cabecalho, aba.linhas[indiceCabecalho - 1], intervalo),
  );
  const incompletos = blocos.filter((b) => b.colunas.hora === undefined || b.colunas.cliente === undefined);
  const validos = blocos.filter((b) => !incompletos.includes(b));

  const corpo = aba.linhas.slice(indiceCabecalho + 1);
  const porBloco = validos.map((bloco) => {
    const resultados = corpo.map((linha, k) =>
      analisarLinha(aba.titulo, data, bloco, linha, numeroDaLinha(indiceCabecalho + 1 + k)),
    );
    return {
      bloco,
      linhas: resultados.flatMap((r) => (r.tipo === 'ok' ? [r.linha] : [])),
      problemas: resultados.flatMap((r) => (r.tipo === 'problema' ? [r.problema] : [])),
    };
  });

  const linhas = porBloco.flatMap((b) => b.linhas);
  const problemas = porBloco.flatMap((b) => b.problemas);
  const avisos = [
    ...(data.anoAssumido ? [`a aba não tem ano; usei ${data.ano}`] : []),
    ...incompletos.map(
      (b) =>
        `bloco de "${b.profissional}" ignorado: faltou a coluna de ` +
        (b.colunas.hora === undefined ? `horário (${NOMES_ACEITOS.hora})` : `cliente (${NOMES_ACEITOS.cliente})`),
    ),
    ...validos
      .filter((b) => b.ignoradas.length > 0)
      .map((b) => `colunas não usadas no bloco de "${b.profissional}": ${b.ignoradas.join(', ')}`),
  ];

  return {
    resumo: {
      ...base,
      data: dataIso(data),
      importada: validos.length > 0,
      motivo: validos.length > 0 ? undefined : 'nenhum bloco de profissional com horário e cliente',
      avisos,
      atendimentos: linhas.length,
      problemas: problemas.length,
      profissionais: porBloco.map((b) => ({
        nome: b.bloco.profissional,
        atendimentos: b.linhas.length,
        colunas: b.bloco.rotulos,
      })),
    },
    linhas,
    problemas,
  };
}

export function analisarPlanilha(abas: Aba[], hoje = new Date()): AnalisePlanilha {
  const analisadas = abas.map((aba) => analisarAba(aba, hoje));
  return {
    abas: analisadas.map((a) => a.resumo),
    linhas: analisadas.flatMap((a) => a.linhas),
    problemas: analisadas.flatMap((a) => a.problemas),
  };
}

// ---------- Google Sheets ----------

/**
 * ID da planilha a partir do link ("…/spreadsheets/d/<ID>/edit") ou o próprio ID colado.
 * https://regex101.com/?flavor=javascript&regex=%5C%2Fd%5C%2F(%5Ba-zA-Z0-9-_%5D%2B)&testString=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1AbC-xyz_9%2Fedit
 */
const ID_NO_LINK = /\/d\/([a-zA-Z0-9-_]+)/;

export function extrairSpreadsheetId(valor: string): string {
  const match = valor.match(ID_NO_LINK);
  return match ? match[1] : valor.trim();
}
