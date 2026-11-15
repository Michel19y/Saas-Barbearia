"use client";

import { use, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatarPreco } from "@/lib/formato";

type Profissional = { id: string; nome: string };
type Servico = { id: string; nome: string; duracaoMin: number; precoCentavos: number };
type Passo = "servico" | "dia" | "horario" | "dados";

const PASSOS: { id: Passo; titulo: string }[] = [
  { id: "servico", titulo: "O que você vai fazer?" },
  { id: "dia", titulo: "Qual dia?" },
  { id: "horario", titulo: "Que horas?" },
  { id: "dados", titulo: "Seus dados" },
];

const FUSO = "America/Sao_Paulo";
/** Dias mostrados no calendário (5 semanas), a partir de hoje. */
const DIAS_NO_CALENDARIO = 35;
const DIAS_NA_SEMANA = 7;
const INICIAIS_DOS_DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MEIO_DIA = 12;
const FIM_DA_TARDE = 18;
const DIGITOS_TELEFONE_MIN = 10;
const DIGITOS_TELEFONE_MAX = 11;
/** Telefone: DDD (2) e o número, com hífen depois de 4 dígitos (fixo, 8) ou 5 (celular, 9). */
const TAMANHO_DDD = 2;
const PRIMEIRA_PARTE_FIXO = 4;
const PRIMEIRA_PARTE_CELULAR = 5;
const DIGITOS_CELULAR = 9;

/** Cores da página do cliente: azul de fachada de barbearia, latão e verde só para "agendado". */
const COR = {
  tinta: "#1F2A44",
  latao: "#B8893B",
  linha: "#D9DEE8",
  superficie: "#F2F4F8",
  sucesso: "#2F7D5B",
};

/** Aparência de cada dia do calendário. */
type EstadoDia = "escolhido" | "indisponivel" | "livre";
const ESTILO_DIA: Record<EstadoDia, { background: string; color: string }> = {
  escolhido: { background: COR.tinta, color: "white" },
  indisponivel: { background: "transparent", color: "#B4BAC6" },
  livre: { background: COR.superficie, color: COR.tinta },
};
function estadoDoDia(escolhido: boolean, desabilitado: boolean): EstadoDia {
  if (escolhido) return "escolhido";
  return desabilitado ? "indisponivel" : "livre";
}
const NOME_MIN = 2;

const BOTAO_PRINCIPAL =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1F2A44] px-5 text-base font-semibold text-white transition-colors hover:bg-[#2c3a5c] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8893B] focus-visible:ring-offset-2";
const CAMPO =
  "min-h-12 w-full rounded-xl border border-[#D9DEE8] bg-white px-4 text-base text-[#1F2A44] placeholder:text-zinc-400 focus-visible:border-[#1F2A44] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2A44]/20";

// ---------- datas ----------

/** "2026-11-15" de hoje no horário de Brasília. */
function hojeNoFuso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

/** Soma dias a uma data "AAAA-MM-DD" sem passar pelo fuso do aparelho. */
function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, "AAAA-MM-DD".length);
}

const diaDaSemana = (data: string) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
};

function formatarData(data: string, opcoes: Intl.DateTimeFormatOptions): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opcoes }).format(new Date(Date.UTC(ano, mes - 1, dia)));
}

const horaDe = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const horaNumero = (iso: string) => Number(horaDe(iso).slice(0, "HH".length));

/** "(11) 98888-7777" enquanto digita; guarda só até 11 dígitos. */
function mascararTelefone(texto: string): string {
  // Só os dígitos: "(11) 9888" vira "119888".
  // https://regex101.com/?flavor=javascript&flags=g&regex=%5CD&testString=(11)%209888
  const d = texto.replace(/\D/g, "").slice(0, DIGITOS_TELEFONE_MAX);
  if (d.length <= TAMANHO_DDD) return d;
  const ddd = d.slice(0, TAMANHO_DDD);
  const resto = d.slice(TAMANHO_DDD);
  if (resto.length <= PRIMEIRA_PARTE_FIXO) return `(${ddd}) ${resto}`;
  const corte = resto.length >= DIGITOS_CELULAR ? PRIMEIRA_PARTE_CELULAR : PRIMEIRA_PARTE_FIXO;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

const digitosDoTelefone = (texto: string) => texto.split("").filter((c) => c >= "0" && c <= "9").length;

// ---------- peças ----------

function Progresso({ atual }: { atual: number }) {
  return (
    <ol aria-label={`Passo ${atual + 1} de ${PASSOS.length}`} className="flex gap-1.5">
      {PASSOS.map((passo, i) => (
        <li
          key={passo.id}
          aria-current={i === atual ? "step" : undefined}
          className="h-1.5 flex-1 rounded-full transition-colors"
          style={{ background: i <= atual ? COR.latao : COR.linha }}
        >
          <span className="sr-only">{passo.titulo}</span>
        </li>
      ))}
    </ol>
  );
}

function Resumo({
  servicos,
  profissional,
  data,
  horario,
}: {
  servicos: Servico[];
  profissional: string;
  data: string | null;
  horario: string | null;
}) {
  const total = servicos.reduce((soma, s) => soma + s.precoCentavos, 0);
  const duracao = servicos.reduce((soma, s) => soma + s.duracaoMin, 0);
  return (
    <dl className="space-y-2 rounded-2xl p-4 text-[15px]" style={{ background: COR.superficie }}>
      <div className="flex justify-between gap-4">
        <dt className="text-zinc-600">Serviço</dt>
        <dd className="text-right font-medium">{servicos.map((s) => s.nome).join(" + ")}</dd>
      </div>
      {data && (
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-600">Quando</dt>
          <dd className="text-right font-medium">
            {formatarData(data, { weekday: "long", day: "numeric", month: "long" })}
            {horario && ` às ${horaDe(horario)}`}
          </dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-zinc-600">Com</dt>
        <dd className="text-right font-medium">{profissional}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t pt-2" style={{ borderColor: COR.linha }}>
        <dt className="text-zinc-600">{duracao} min</dt>
        <dd className="text-right font-semibold">{formatarPreco(total)}</dd>
      </div>
    </dl>
  );
}

// ---------- página ----------

export default function AgendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const hoje = useMemo(() => hojeNoFuso(), []);

  const [nomeBarbearia, setNomeBarbearia] = useState("");
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [passo, setPasso] = useState<Passo>("servico");
  const [servicoIds, setServicoIds] = useState<string[]>([]);
  const [profissionalId, setProfissionalId] = useState("");
  const [diasAbertos, setDiasAbertos] = useState<string[] | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [agendado, setAgendado] = useState(false);

  // Dados da barbearia; link antigo é trocado pelo atual na barra de endereço
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const [barbearia, lista, equipe] = await Promise.all([
          apiFetch(`/publico/${slug}`) as Promise<{ nome: string; slug: string }>,
          apiFetch(`/publico/${slug}/servicos`) as Promise<Servico[]>,
          (apiFetch(`/publico/${slug}/profissionais`) as Promise<Profissional[]>).catch(() => []),
        ]);
        if (!ativo) return;
        setNomeBarbearia(barbearia.nome);
        setServicos(lista);
        setProfissionais(equipe);
        if (barbearia.slug && barbearia.slug !== slug) router.replace(`/agendar/${barbearia.slug}`);
      } catch {
        if (ativo) setErro("Não encontramos essa barbearia. Confira o link que você recebeu.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [slug, router]);

  // Dias abertos para o calendário (muda se escolher um profissional de folga em algum dia)
  useEffect(() => {
    if (passo !== "dia") return;
    let ativo = true;
    async function carregarDias() {
      try {
        const quem = profissionalId ? `&profissionalId=${encodeURIComponent(profissionalId)}` : "";
        const { abertos } = (await apiFetch(
          `/publico/${slug}/dias?de=${hoje}&dias=${DIAS_NO_CALENDARIO}${quem}`,
        )) as { abertos: string[] };
        if (ativo) setDiasAbertos(abertos);
      } catch {
        if (ativo) setDiasAbertos(null);
      }
    }
    void carregarDias();
    return () => {
      ativo = false;
    };
  }, [passo, slug, hoje, profissionalId]);

  // Horários livres do dia escolhido
  useEffect(() => {
    if (passo !== "horario" || !data || servicoIds.length === 0) return;
    let ativo = true;
    async function carregarHorarios() {
      try {
        const quem = profissionalId ? `&profissionalId=${encodeURIComponent(profissionalId)}` : "";
        const lista = (await apiFetch(
          `/publico/${slug}/horarios?servicoIds=${encodeURIComponent(servicoIds.join(","))}&data=${data}${quem}`,
        )) as string[];
        if (ativo) setHorarios(lista);
      } catch {
        if (ativo) setHorarios([]);
      }
    }
    void carregarHorarios();
    return () => {
      ativo = false;
    };
  }, [passo, slug, data, servicoIds, profissionalId]);

  const indicePasso = PASSOS.findIndex((p) => p.id === passo);
  const escolhidos = servicos.filter((s) => servicoIds.includes(s.id));
  const nomeProfissional = profissionais.find((p) => p.id === profissionalId)?.nome ?? "Quem estiver livre";

  // Calendário: semanas completas de domingo a sábado, cobrindo os próximos dias
  const calendario = useMemo(() => {
    const inicio = somarDias(hoje, -diaDaSemana(hoje));
    const fim = somarDias(hoje, DIAS_NO_CALENDARIO - 1);
    const total = Math.ceil((diaDaSemana(hoje) + DIAS_NO_CALENDARIO) / DIAS_NA_SEMANA) * DIAS_NA_SEMANA;
    return Array.from({ length: total }, (_, i) => somarDias(inicio, i)).map((dia) => ({
      dia,
      foraDoPeriodo: dia < hoje || dia > fim,
    }));
  }, [hoje]);
  const meses = [...new Set(calendario.filter((c) => !c.foraDoPeriodo).map((c) => formatarData(c.dia, { month: "long" })))];

  const turnos = useMemo(() => {
    const lista = horarios ?? [];
    return [
      { nome: "Manhã", itens: lista.filter((h) => horaNumero(h) < MEIO_DIA) },
      { nome: "Tarde", itens: lista.filter((h) => horaNumero(h) >= MEIO_DIA && horaNumero(h) < FIM_DA_TARDE) },
      { nome: "Noite", itens: lista.filter((h) => horaNumero(h) >= FIM_DA_TARDE) },
    ].filter((t) => t.itens.length > 0);
  }, [horarios]);

  function irPara(proximo: Passo) {
    setErro(null);
    setPasso(proximo);
    window.scrollTo({ top: 0 });
  }

  function voltar() {
    irPara(PASSOS[Math.max(indicePasso - 1, 0)].id);
  }

  function alternarServico(id: string) {
    setServicoIds((atual) => (atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]));
  }

  function escolherDia(dia: string) {
    setData(dia);
    setHorario(null);
    setHorarios(null);
    irPara("horario");
  }

  function escolherHorario(h: string) {
    setHorario(h);
    irPara("dados");
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!horario) return;
    setErro(null);
    setEnviando(true);
    try {
      await apiFetch(`/publico/${slug}/agendamento`, {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim(),
          telefone,
          servicoIds,
          inicio: horario,
          ...(profissionalId ? { profissionalId } : {}),
        }),
      });
      setAgendado(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      // Horário pego por outra pessoa enquanto preenchia: volta para escolher outro
      setHorario(null);
      setHorarios(null);
      setPasso("horario");
      setErro(err instanceof Error ? err.message : "Não deu para marcar esse horário. Escolha outro.");
    } finally {
      setEnviando(false);
    }
  }

  function marcarOutro() {
    setAgendado(false);
    setServicoIds([]);
    setData(null);
    setHorario(null);
    setHorarios(null);
    irPara("servico");
  }

  const telefoneValido = digitosDoTelefone(telefone) >= DIGITOS_TELEFONE_MIN;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-8 text-[#1F2A44]">
      <header className="mb-6">
        <h1
          className="text-[2.6rem] leading-[0.95] font-bold tracking-tight uppercase"
          style={{ fontFamily: "var(--font-letreiro), sans-serif" }}
        >
          {nomeBarbearia || " "}
        </h1>
        <p className="mt-1 text-base text-zinc-600">Marque seu horário em poucos toques.</p>
      </header>

      {carregando && (
        <p role="status" className="flex items-center gap-2 text-zinc-600">
          <Loader2 aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" /> Carregando…
        </p>
      )}

      {!carregando && servicos.length === 0 && (
        <p className="rounded-2xl p-4 text-base" style={{ background: COR.superficie }}>
          {erro ?? "Essa barbearia ainda não abriu horários pelo link. Fale com ela pelo WhatsApp."}
        </p>
      )}

      {!carregando && servicos.length > 0 && agendado && horario && data && (
        <section aria-live="polite" className="flex flex-1 flex-col items-center pt-6 text-center">
          <span
            className="animar-carimbo flex size-20 items-center justify-center rounded-full text-white"
            style={{ background: COR.sucesso }}
          >
            <Check aria-hidden="true" size={44} strokeWidth={3} />
          </span>
          <h2 className="mt-5 text-2xl font-semibold">Agendado!</h2>
          <p className="mt-1 text-base text-zinc-600">
            Te esperamos {formatarData(data, { weekday: "long" })} às {horaDe(horario)}.
          </p>
          <div className="mt-6 w-full text-left">
            <Resumo servicos={escolhidos} profissional={nomeProfissional} data={data} horario={horario} />
          </div>
          <button type="button" onClick={marcarOutro} className="mt-6 min-h-12 text-base font-semibold underline underline-offset-4">
            Marcar outro horário
          </button>
        </section>
      )}

      {!carregando && servicos.length > 0 && !agendado && (
        <section aria-labelledby="passo-titulo" className="flex flex-1 flex-col">
          <Progresso atual={indicePasso} />
          <div className="mt-4 mb-5 flex items-center gap-1">
            {indicePasso > 0 && (
              <button
                type="button"
                onClick={voltar}
                aria-label="Voltar"
                className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-[#F2F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8893B]"
              >
                <ChevronLeft aria-hidden="true" size={24} />
              </button>
            )}
            <h2 id="passo-titulo" className="text-xl font-semibold">
              {PASSOS[indicePasso].titulo}
            </h2>
          </div>

          {erro && (
            <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[15px] text-red-800">
              {erro}
            </p>
          )}

          {passo === "servico" && (
            <div className="flex flex-1 flex-col">
              <p className="mb-3 text-[15px] text-zinc-600">Pode escolher mais de um, como corte e barba.</p>
              <ul className="space-y-2">
                {servicos.map((s) => {
                  const marcado = servicoIds.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-pressed={marcado}
                        onClick={() => alternarServico(s.id)}
                        className="flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8893B]"
                        style={{
                          borderColor: marcado ? COR.tinta : COR.linha,
                          background: marcado ? COR.superficie : "white",
                        }}
                      >
                        <span className="flex-1">
                          <span className="block text-[17px] font-semibold">{s.nome}</span>
                          <span className="block text-[15px] text-zinc-600">
                            {s.duracaoMin} min, {formatarPreco(s.precoCentavos)}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="flex size-7 shrink-0 items-center justify-center rounded-full border-2"
                          style={{
                            borderColor: marcado ? COR.tinta : COR.linha,
                            background: marcado ? COR.tinta : "white",
                          }}
                        >
                          {marcado && <Check size={16} strokeWidth={3} className="text-white" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {profissionais.length > 1 && (
                <fieldset className="mt-6">
                  <legend className="mb-2 text-[15px] font-semibold">Com quem?</legend>
                  <div className="flex flex-wrap gap-2">
                    {[{ id: "", nome: "Quem estiver livre" }, ...profissionais].map((p) => {
                      const ativo = profissionalId === p.id;
                      return (
                        <button
                          key={p.id || "qualquer"}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setProfissionalId(p.id)}
                          className="min-h-11 rounded-full border-2 px-4 text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8893B]"
                          style={{
                            borderColor: ativo ? COR.tinta : COR.linha,
                            background: ativo ? COR.tinta : "white",
                            color: ativo ? "white" : COR.tinta,
                          }}
                        >
                          {p.nome}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="sticky bottom-0 -mx-4 mt-auto border-t bg-white/95 px-4 pt-3 pb-4 backdrop-blur" style={{ borderColor: COR.linha }}>
                {escolhidos.length > 0 && (
                  <p className="mb-2 flex justify-between text-[15px]">
                    <span className="truncate pr-3">{escolhidos.map((s) => s.nome).join(" + ")}</span>
                    <span className="shrink-0 font-semibold">
                      {formatarPreco(escolhidos.reduce((soma, s) => soma + s.precoCentavos, 0))}
                    </span>
                  </p>
                )}
                <button type="button" disabled={escolhidos.length === 0} onClick={() => irPara("dia")} className={BOTAO_PRINCIPAL}>
                  {escolhidos.length === 0 ? "Escolha um serviço" : "Escolher o dia"}
                </button>
              </div>
            </div>
          )}

          {passo === "dia" && (
            <div>
              <p className="mb-3 text-[15px] capitalize text-zinc-600">{meses.join(" e ")}</p>
              <div role="grid" aria-label="Calendário" className="grid grid-cols-7 gap-1.5 text-center">
                {INICIAIS_DOS_DIAS.map((inicial, i) => (
                  <span key={`${inicial}-${i}`} aria-hidden="true" className="pb-1 text-sm font-medium text-zinc-500">
                    {inicial}
                  </span>
                ))}
                {calendario.map(({ dia, foraDoPeriodo }) => {
                  const fechado = !foraDoPeriodo && diasAbertos !== null && !diasAbertos.includes(dia);
                  const desabilitado = foraDoPeriodo || fechado || diasAbertos === null;
                  const ehHoje = dia === hoje;
                  const escolhido = dia === data;
                  return (
                    <button
                      key={dia}
                      type="button"
                      disabled={desabilitado}
                      onClick={() => escolherDia(dia)}
                      aria-label={`${formatarData(dia, { weekday: "long", day: "numeric", month: "long" })}${fechado ? ", fechado" : ""}`}
                      className="relative flex aspect-square items-center justify-center rounded-xl text-[17px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8893B] disabled:cursor-not-allowed"
                      style={{
                        ...ESTILO_DIA[estadoDoDia(escolhido, desabilitado)],
                        textDecoration: fechado ? "line-through" : undefined,
                        visibility: foraDoPeriodo && dia < hoje ? "hidden" : undefined,
                      }}
                    >
                      {Number(dia.slice(-"DD".length))}
                      {ehHoje && (
                        <span aria-hidden="true" className="absolute bottom-1.5 size-1 rounded-full" style={{ background: COR.latao }} />
                      )}
                    </button>
                  );
                })}
              </div>
              {diasAbertos === null && (
                <p role="status" className="mt-4 flex items-center gap-2 text-[15px] text-zinc-600">
                  <Loader2 aria-hidden="true" size={16} className="animate-spin motion-reduce:animate-none" /> Vendo os dias livres…
                </p>
              )}
              {diasAbertos !== null && (
                <p className="mt-4 text-sm text-zinc-500">Dias riscados: a barbearia não atende.</p>
              )}
            </div>
          )}

          {passo === "horario" && data && (
            <div>
              <p className="mb-4 text-[15px] text-zinc-600 first-letter:uppercase">
                {formatarData(data, { weekday: "long", day: "numeric", month: "long" })}
              </p>
              {horarios === null && (
                <p role="status" className="flex items-center gap-2 text-[15px] text-zinc-600">
                  <Loader2 aria-hidden="true" size={16} className="animate-spin motion-reduce:animate-none" /> Vendo os horários…
                </p>
              )}
              {horarios !== null && horarios.length === 0 && (
                <div className="rounded-2xl p-4 text-[15px]" style={{ background: COR.superficie }}>
                  <p>Esse dia já está cheio.</p>
                  <button type="button" onClick={voltar} className="mt-2 min-h-11 font-semibold underline underline-offset-4">
                    Escolher outro dia
                  </button>
                </div>
              )}
              {turnos.map((turno) => (
                <div key={turno.nome} className="mb-5">
                  <h3 className="mb-2 text-[15px] font-semibold">{turno.nome}</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {turno.itens.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => escolherHorario(h)}
                        className="min-h-12 rounded-xl border-2 text-base font-semibold tabular-nums transition-colors hover:border-[#1F2A44] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8893B]"
                        style={{ borderColor: COR.linha }}
                      >
                        {horaDe(h)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {passo === "dados" && horario && (
            <form onSubmit={confirmar} className="space-y-4">
              <Resumo servicos={escolhidos} profissional={nomeProfissional} data={data} horario={horario} />
              <div className="space-y-1.5">
                <label htmlFor="cliente-nome" className="text-[15px] font-semibold">
                  Seu nome
                </label>
                <input
                  id="cliente-nome"
                  required
                  minLength={NOME_MIN}
                  autoComplete="name"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className={CAMPO}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cliente-telefone" className="text-[15px] font-semibold">
                  WhatsApp
                </label>
                <input
                  id="cliente-telefone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(11) 98888-7777"
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  className={`${CAMPO} tabular-nums`}
                />
                <p className="text-sm text-zinc-500">A barbearia usa para confirmar ou avisar de mudanças.</p>
              </div>
              <button type="submit" disabled={enviando || nome.trim().length < NOME_MIN || !telefoneValido} className={BOTAO_PRINCIPAL}>
                {enviando && <Loader2 aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" />}
                {enviando ? "Marcando…" : "Confirmar agendamento"}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
