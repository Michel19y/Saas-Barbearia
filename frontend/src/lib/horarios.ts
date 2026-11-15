/** Tipos e utilidades da tela de horários de funcionamento (espelham backend/src/horarios). */

/** Um dia da semana; a pausa (ex.: almoço) é opcional e fica dentro do expediente. */
export type DiaSemana = {
  aberto: boolean;
  inicio: string;
  fim: string;
  pausaInicio?: string | null;
  pausaFim?: string | null;
};
/** 7 dias, 0 = domingo. */
export type Semana = DiaSemana[];

export type Excecao = {
  id: string;
  profissionalId: string | null;
  profissionalNome: string | null;
  data: string;
  fechado: boolean;
  inicio: string | null;
  fim: string | null;
  pausaInicio: string | null;
  pausaFim: string | null;
  motivo: string | null;
};

export type DadosHorarios = {
  barbearia: { semana: Semana; personalizada: boolean };
  profissionais: Array<{ id: string; nome: string; ativo: boolean; semana: Semana | null }>;
  excecoes: Excecao[];
};

export type Mudanca =
  | { tipo: "semana"; profissionalId: string | null; semana: Semana | null }
  | {
      tipo: "excecao";
      profissionalId: string | null;
      data: string;
      fechado: boolean;
      inicio?: string;
      fim?: string;
      pausaInicio?: string;
      pausaFim?: string;
      motivo?: string;
    }
  | { tipo: "remover-excecao"; excecaoId: string };

export type Afetado = {
  id: string;
  inicio: string;
  fim: string;
  clienteNome: string;
  telefone: string | null;
  servico: string;
  profissional: string;
};

export const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const NOMES_DIAS_PLURAL = [
  "todo domingo",
  "toda segunda-feira",
  "toda terça-feira",
  "toda quarta-feira",
  "toda quinta-feira",
  "toda sexta-feira",
  "todo sábado",
];
const FUSO = "America/Sao_Paulo";

/** Dia da semana (0 = domingo) de "AAAA-MM-DD", sem depender do fuso do navegador. */
export function diaDaSemana(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export const todaSemanaDe = (data: string) => NOMES_DIAS_PLURAL[diaDaSemana(data)];

/** "qui., 10/12" para uma data "AAAA-MM-DD". */
export function dataCurta(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(Date.UTC(ano, mes - 1, dia)),
  );
}

/** Hoje em Brasília, "AAAA-MM-DD". */
export function hojeNoFuso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

export function dataHoraCurta(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const descreverPausa = (inicio?: string | null, fim?: string | null) => (inicio && fim ? ` · pausa ${inicio}–${fim}` : "");

export const descreverDia = (dia: DiaSemana) =>
  dia.aberto ? `${dia.inicio}–${dia.fim}${descreverPausa(dia.pausaInicio, dia.pausaFim)}` : "Fechado";

export function descreverExcecao(e: Pick<Excecao, "fechado" | "inicio" | "fim" | "pausaInicio" | "pausaFim">): string {
  return e.fechado ? "Fechado" : `${e.inicio}–${e.fim}${descreverPausa(e.pausaInicio, e.pausaFim)}`;
}

/** Pausa vazia ou dentro do expediente, com início antes do fim (mesma regra do servidor). */
export function pausaValida(inicio: string, fim: string, pausaInicio?: string | null, pausaFim?: string | null) {
  if (!pausaInicio && !pausaFim) return true;
  if (!pausaInicio || !pausaFim) return false;
  return pausaInicio < pausaFim && pausaInicio >= inicio && pausaFim <= fim;
}

/** Erro do dia para mostrar ao lado dos campos; null se estiver tudo certo. */
export function erroDoDia(dia: DiaSemana): string | null {
  if (!dia.aberto) return null;
  if (dia.inicio >= dia.fim) return "O início precisa ser antes do fim";
  if (!pausaValida(dia.inicio, dia.fim, dia.pausaInicio, dia.pausaFim)) return "A pausa precisa ficar dentro do expediente";
  return null;
}

/** A semana com um dia trocado (para transformar "só neste dia" em "toda semana"). */
export function semanaComDia(semana: Semana, indice: number, dia: DiaSemana): Semana {
  return semana.map((atual, i) => (i === indice ? dia : atual));
}

/** Só os dígitos do telefone: "(11) 98888-7777" vira "11988887777". */
export function digitos(telefone: string | null): string {
  // Tudo que não é dígito sai: em "(11) 98888-7777" saem "(", ")", " " e "-"; os números ficam.
  // https://regex101.com/?flavor=javascript&flags=g&regex=%5CD&testString=(11)%2098888-7777
  return (telefone ?? "").replace(/\D/g, "");
}

/** Link do WhatsApp com a mensagem pronta para avisar o cliente do cancelamento. */
export function linkWhatsApp(afetado: Afetado): string {
  const mensagem =
    `Olá, ${afetado.clienteNome}! Precisamos desmarcar seu horário de ${dataHoraCurta(afetado.inicio)} ` +
    `(${afetado.servico}), porque não vamos atender nesse horário. Quer remarcar para outro dia?`;
  return `https://wa.me/55${digitos(afetado.telefone)}?text=${encodeURIComponent(mensagem)}`;
}
