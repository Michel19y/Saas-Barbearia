export type LinhaBloco = {
  horario: string;
  tipoServico: string;
  cliente: string;
  entrada: string;
  fp: string;
};

export type BlocoProfissional = {
  profissional: string;
  linhas: LinhaBloco[];
};

/**
 * A planilha tem um bloco de 5 colunas (HORARIO, TIPO DO SERVIÇO, CLIENTE,
 * ENTRADA, FP) por profissional, lado a lado na mesma aba. O nome do
 * profissional fica na linha acima do cabeçalho "HORARIO".
 */
export function encontrarBlocosDeProfissional(linhas: string[][]): BlocoProfissional[] {
  let headerRowIndex = -1;
  let colunasHorario: number[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const indices = linha
      .map((valor, idx) => ({ valor: (valor ?? '').trim().toLowerCase(), idx }))
      .filter((c) => c.valor === 'horario' || c.valor === 'horário')
      .map((c) => c.idx);
    if (indices.length > 0) {
      headerRowIndex = i;
      colunasHorario = indices;
      break;
    }
  }

  if (headerRowIndex === -1) return [];

  const linhaAcima = linhas[headerRowIndex - 1] ?? [];
  const blocos: BlocoProfissional[] = [];

  for (const colInicio of colunasHorario) {
    const profissional =
      linhaAcima
        .slice(colInicio, colInicio + 5)
        .find((v) => (v ?? '').trim())
        ?.trim() ?? 'Profissional não identificado';

    const dadosLinha: LinhaBloco[] = [];
    for (let i = headerRowIndex + 1; i < linhas.length; i++) {
      const horario = (linhas[i]?.[colInicio] ?? '').trim();
      if (!/^\d{1,2}:\d{2}/.test(horario)) break;
      dadosLinha.push({
        horario,
        tipoServico: linhas[i]?.[colInicio + 1] ?? '',
        cliente: linhas[i]?.[colInicio + 2] ?? '',
        entrada: linhas[i]?.[colInicio + 3] ?? '',
        fp: linhas[i]?.[colInicio + 4] ?? '',
      });
    }

    blocos.push({ profissional, linhas: dadosLinha });
  }

  return blocos;
}

/** O nome da aba é a data do dia (ex: "06/11" ou "06/11/2026"). */
export function parseDataAba(titulo: string): Date | null {
  const texto = titulo.trim();

  let match = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const data = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(data.getTime()) ? null : data;
  }

  match = texto.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const [, d, m] = match;
    const ano = new Date().getFullYear();
    const data = new Date(ano, Number(m) - 1, Number(d));
    return Number.isNaN(data.getTime()) ? null : data;
  }

  return null;
}

const FORMAS_PAGAMENTO: Record<string, string> = {
  'C-D': 'Cartão Débito',
  CD: 'Cartão Débito',
  'C-C': 'Cartão Crédito',
  CC: 'Cartão Crédito',
  D: 'Dinheiro',
  P: 'Pix',
};

export function mapearFormaPagamento(codigo: string | undefined): string {
  if (!codigo) return 'Não informado';
  const chave = codigo.trim().toUpperCase();
  return FORMAS_PAGAMENTO[chave] ?? codigo.trim();
}

export function parseValorParaCentavos(valor: string | undefined): number | null {
  if (!valor) return null;
  const limpo = valor.replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return null;

  let normalizado = limpo;
  if (normalizado.includes(',')) {
    normalizado = normalizado.replace(/\./g, '').replace(',', '.');
  }

  const numero = Number(normalizado);
  if (Number.isNaN(numero)) return null;
  return Math.round(numero * 100);
}

export function extrairSpreadsheetId(valor: string): string {
  const match = valor.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : valor.trim();
}
