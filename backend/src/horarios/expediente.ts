/**
 * Regra de expediente: quando cada profissional atende, em cada data.
 *
 * Dois níveis, do mais geral ao mais específico:
 *  1. Barbearia: semana padrão + exceções por data (fechar o dia 10, ou dia 10 só 14h–18h).
 *  2. Profissional: por padrão segue a barbearia; pode ter semana própria e exceções próprias
 *     (folga no dia 10). O horário dele é sempre recortado pelo da barbearia: se a barbearia
 *     fecha, ninguém atende; se abre 9h–19h, ninguém atende às 20h.
 *
 * Módulo puro (sem banco): a página pública, a simulação de impacto e os testes usam o mesmo cálculo.
 * Horários são do fuso da barbearia (Brasília).
 */

export type DiaSemana = { aberto: boolean; inicio: string; fim: string };
/** 7 posições: 0 = domingo … 6 = sábado (igual ao Date#getDay). */
export type Semana = DiaSemana[];

export type Excecao = {
  id?: string;
  profissionalId: string | null;
  data: string;
  fechado: boolean;
  inicio: string | null;
  fim: string | null;
  motivo?: string | null;
};

export type ConfigExpediente = {
  /** null = padrão (09:00–21:00 todos os dias), o comportamento de antes desta funcionalidade. */
  barbearia: Semana | null;
  /** Por profissional; null/ausente = segue a barbearia. */
  profissionais: Record<string, Semana | null | undefined>;
  excecoes: Excecao[];
};

/** Janela do dia em minutos desde a meia-noite; null = fechado. */
export type Janela = { inicioMin: number; fimMin: number } | null;

export const DIAS_DA_SEMANA = 7;
const ABERTURA_PADRAO = '09:00';
const FECHAMENTO_PADRAO = '21:00';
export const SEMANA_PADRAO: Semana = Array.from({ length: DIAS_DA_SEMANA }, () => ({
  aberto: true,
  inicio: ABERTURA_PADRAO,
  fim: FECHAMENTO_PADRAO,
}));

const MINUTOS_NA_HORA = 60;
const MS_POR_MINUTO = 60_000;
const DIGITOS = 2;
/** Brasília (sem horário de verão desde 2019). */
export const FUSO = '-03:00';
const FUSO_EM_MINUTOS = -180;

/**
 * Horário "HH:MM" de 00:00 a 23:59. Aceita "09:00" e "23:59"; recusa "9:00", "24:00" e "12:60".
 * https://regex101.com/?flavor=javascript&regex=%5E(%5B01%5D%5Cd%7C2%5B0-3%5D)%3A%5B0-5%5D%5Cd%24&testString=09%3A00%0A23%3A59%0A9%3A00%0A24%3A00%0A12%3A60
 */
export const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
/**
 * Data "AAAA-MM-DD". Aceita "2026-12-10"; recusa "10/12/2026" e "2026-1-5".
 * https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7D%24&testString=2026-12-10%0A10%2F12%2F2026%0A2026-1-5
 */
export const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * MINUTOS_NA_HORA + m;
}

const doisDigitos = (n: number) => String(n).padStart(DIGITOS, '0');

export function horaDeMinutos(total: number): string {
  return `${doisDigitos(Math.floor(total / MINUTOS_NA_HORA))}:${doisDigitos(total % MINUTOS_NA_HORA)}`;
}

/** Dia da semana (0 = domingo) de uma data "AAAA-MM-DD". */
export function diaDaSemana(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Instante de "data + minutos" no fuso da barbearia. */
export function instante(data: string, minutosDoDia: number): Date {
  return new Date(`${data}T${horaDeMinutos(minutosDoDia)}:00${FUSO}`);
}

/** Data e minutos do dia (no fuso da barbearia) de um instante. */
export function noFuso(momento: Date): { data: string; minutos: number } {
  const local = new Date(momento.getTime() + FUSO_EM_MINUTOS * MS_POR_MINUTO);
  const data = `${local.getUTCFullYear()}-${doisDigitos(local.getUTCMonth() + 1)}-${doisDigitos(local.getUTCDate())}`;
  return { data, minutos: local.getUTCHours() * MINUTOS_NA_HORA + local.getUTCMinutes() };
}

/** Semana guardada no banco (JSON) só é usada se tiver o formato certo; senão vale o padrão. */
export function semanaValida(valor: unknown): Semana | null {
  if (!Array.isArray(valor) || valor.length !== DIAS_DA_SEMANA) return null;
  const ok = valor.every(
    (d) =>
      d &&
      typeof d.aberto === 'boolean' &&
      FORMATO_HORA.test(String(d.inicio)) &&
      FORMATO_HORA.test(String(d.fim)) &&
      minutos(d.inicio) < minutos(d.fim),
  );
  return ok ? (valor as Semana) : null;
}

function janelaDoDia(dia: DiaSemana | undefined): Janela {
  if (!dia?.aberto) return null;
  return { inicioMin: minutos(dia.inicio), fimMin: minutos(dia.fim) };
}

function janelaDaExcecao(excecao: Excecao): Janela {
  if (excecao.fechado || !excecao.inicio || !excecao.fim) return null;
  return { inicioMin: minutos(excecao.inicio), fimMin: minutos(excecao.fim) };
}

function intersecao(a: Janela, b: Janela): Janela {
  if (!a || !b) return null;
  const inicioMin = Math.max(a.inicioMin, b.inicioMin);
  const fimMin = Math.min(a.fimMin, b.fimMin);
  return inicioMin < fimMin ? { inicioMin, fimMin } : null;
}

const excecaoDe = (config: ConfigExpediente, profissionalId: string | null, data: string) =>
  config.excecoes.find((e) => e.profissionalId === profissionalId && e.data === data);

/** Expediente da barbearia numa data (exceção do dia, senão a semana). */
export function janelaDaBarbearia(config: ConfigExpediente, data: string): Janela {
  const excecao = excecaoDe(config, null, data);
  if (excecao) return janelaDaExcecao(excecao);
  return janelaDoDia((config.barbearia ?? SEMANA_PADRAO)[diaDaSemana(data)]);
}

/** Expediente efetivo de um profissional numa data: o dele recortado pelo da barbearia. */
export function janelaDoProfissional(config: ConfigExpediente, profissionalId: string, data: string): Janela {
  const daBarbearia = janelaDaBarbearia(config, data);
  if (!daBarbearia) return null;
  const excecao = excecaoDe(config, profissionalId, data);
  if (excecao) return intersecao(daBarbearia, janelaDaExcecao(excecao));
  const semanaPropria = config.profissionais[profissionalId];
  if (!semanaPropria) return daBarbearia;
  return intersecao(daBarbearia, janelaDoDia(semanaPropria[diaDaSemana(data)]));
}

/** O atendimento [inicio, fim) cabe inteiro no expediente do profissional? */
export function cabeNoExpediente(
  config: ConfigExpediente,
  profissionalId: string,
  inicio: Date,
  fim: Date,
): boolean {
  const { data, minutos: inicioMin } = noFuso(inicio);
  const janela = janelaDoProfissional(config, profissionalId, data);
  if (!janela) return false;
  const fimMin = inicioMin + (fim.getTime() - inicio.getTime()) / MS_POR_MINUTO;
  return inicioMin >= janela.inicioMin && fimMin <= janela.fimMin;
}

// ---------- mudanças ----------

export type Mudanca =
  | { tipo: 'semana'; profissionalId: string | null; semana: Semana | null }
  | ({ tipo: 'excecao' } & Omit<Excecao, 'id'>)
  | { tipo: 'remover-excecao'; excecaoId: string };

/** A configuração como ficaria depois da mudança (para simular o impacto antes de gravar). */
export function aplicarMudanca(config: ConfigExpediente, mudanca: Mudanca): ConfigExpediente {
  if (mudanca.tipo === 'semana') {
    if (mudanca.profissionalId === null) return { ...config, barbearia: mudanca.semana };
    return { ...config, profissionais: { ...config.profissionais, [mudanca.profissionalId]: mudanca.semana } };
  }
  if (mudanca.tipo === 'remover-excecao') {
    return { ...config, excecoes: config.excecoes.filter((e) => e.id !== mudanca.excecaoId) };
  }
  const { tipo: _tipo, ...nova } = mudanca;
  const outras = config.excecoes.filter((e) => !(e.profissionalId === nova.profissionalId && e.data === nova.data));
  return { ...config, excecoes: [...outras, nova] };
}
