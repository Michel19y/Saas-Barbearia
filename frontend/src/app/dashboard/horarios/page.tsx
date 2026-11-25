"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CalendarOff, Loader2, Trash2 } from "lucide-react";
import AfetadosDialog from "@/components/AfetadosDialog";
import Toast from "@/components/Toast";
import { authFetch, decodeToken, getToken } from "@/lib/auth";
import {
  type Afetado,
  type DadosHorarios,
  type DiaSemana,
  type Mudanca,
  type Semana,
  NOMES_DIAS,
  dataCurta,
  descreverDia,
  descreverExcecao,
  diaDaSemana,
  hojeNoFuso,
  semanaComDia,
  todaSemanaDe,
  erroDoDia,
  pausaValida,
} from "@/lib/horarios";

const BARBEARIA = "barbearia";
const CAMPO =
  "min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:bg-zinc-100 disabled:text-zinc-500";
const BOTAO_PRIMARIO =
  "flex min-h-11 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-base font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60";
const BOTAO_SECUNDARIO =
  "min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-base font-semibold hover:bg-zinc-50 disabled:opacity-60";

type Pendente = { mudanca: Mudanca; descricao: string; afetados: Afetado[] };
type DiaForm = {
  data: string;
  fechado: boolean;
  inicio: string;
  fim: string;
  comPausa: boolean;
  pausaInicio: string;
  pausaFim: string;
  motivo: string;
};

/** Sugestão ao ligar a pausa: almoço do meio-dia à uma. */
const PAUSA_SUGERIDA = { pausaInicio: "12:00", pausaFim: "13:00" };
const diaVazio = (): DiaForm => ({
  data: hojeNoFuso(),
  fechado: true,
  inicio: "09:00",
  fim: "18:00",
  comPausa: false,
  ...PAUSA_SUGERIDA,
  motivo: "",
});
const semanaValida = (semana: Semana) => semana.every((d) => erroDoDia(d) === null);

/** Erro 409 da API quando a mudança cancelaria agendamentos (o corpo traz a lista). */
type ErroComAfetados = Error & { dados?: { afetados?: Afetado[] } };

const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

const DUAS_CASAS = 2;
const HORAS_DO_DIA = 24;
const MINUTOS_NA_HORA = 60;
/** Minutos de 5 em 5: suficiente para a agenda, que trabalha em blocos de 30 min. */
const PASSO_MINUTOS = 5;
/**
 * Seletor estreito de hora/minuto: a setinha fica a 0,75rem da borda e o texto não encosta nela.
 * Inline porque o .campo-select (globals.css) fixa um respiro maior, pensado para seletores largos.
 */
const ESTILO_SELETOR_CURTO = { paddingRight: "2.25rem", backgroundPosition: "right 0.75rem center" };
const comZero = (n: number) => String(n).padStart(DUAS_CASAS, "0");
const OPCOES_HORA = Array.from({ length: HORAS_DO_DIA }, (_, h) => comZero(h));
const OPCOES_MINUTO = Array.from({ length: MINUTOS_NA_HORA / PASSO_MINUTOS }, (_, i) => comZero(i * PASSO_MINUTOS));

/**
 * Campo de hora: duas listas (hora e minuto) no estilo dos seletores do app.
 * Não usa o relógio nativo do celular (input type="time"): no Android ele abre uma janela
 * do sistema que o site não consegue ajustar (com botão cortado na borda) e tem largura
 * mínima própria que vazava do card. Valor continua no formato "HH:MM".
 */
function CampoHora({
  id,
  rotulo,
  descricao,
  valor,
  desabilitado = false,
  onChange,
}: {
  id: string;
  rotulo: string;
  /** Texto completo para leitor de tela, ex.: "Segunda: abre às". */
  descricao?: string;
  valor: string;
  desabilitado?: boolean;
  onChange: (valor: string) => void;
}) {
  const [hora = "", minuto = ""] = valor.split(":");
  // Um minuto fora do passo (ex.: 12:07 vindo de antes) continua aparecendo e escolhível
  const minutos = minuto && !OPCOES_MINUTO.includes(minuto) ? [...OPCOES_MINUTO, minuto].sort() : OPCOES_MINUTO;
  const nome = descricao ?? rotulo;
  const seletor = `${CAMPO} campo-select w-full min-w-0 flex-1 tabular-nums`;

  return (
    <div role="group" aria-label={nome} className="flex min-w-[9.5rem] flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {rotulo}
      </label>
      <div className="flex items-center gap-1">
        <select
          id={id}
          value={hora}
          disabled={desabilitado}
          aria-label={`${nome}: hora`}
          onChange={(e) => onChange(`${e.target.value}:${minuto || "00"}`)}
          className={seletor}
          style={ESTILO_SELETOR_CURTO}
        >
          {!hora && <option value="">--</option>}
          {OPCOES_HORA.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="font-semibold">
          :
        </span>
        <select
          id={`${id}-minuto`}
          value={minuto}
          disabled={desabilitado}
          aria-label={`${nome}: minuto`}
          onChange={(e) => onChange(`${hora || "00"}:${e.target.value}`)}
          className={seletor}
          style={ESTILO_SELETOR_CURTO}
        >
          {!minuto && <option value="">--</option>}
          {minutos.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TabelaSemana({
  semana,
  editavel,
  onChange,
}: {
  semana: Semana;
  editavel: boolean;
  onChange: (semana: Semana) => void;
}) {
  const mudar = (indice: number, dia: Partial<DiaSemana>) =>
    onChange(semana.map((atual, i) => (i === indice ? { ...atual, ...dia } : atual)));

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
      {semana.map((dia, i) => (
        <li key={NOMES_DIAS[i]} className="flex flex-wrap items-center gap-3 p-3">
          <span className="w-20 font-semibold">{NOMES_DIAS[i]}</span>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={dia.aberto}
              disabled={!editavel}
              onChange={(e) => mudar(i, { aberto: e.target.checked })}
              className="size-5"
            />
            {dia.aberto ? "Aberto" : "Fechado"}
          </label>
          {dia.aberto && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-1">
              <CampoHora
                id={`semana-${i}-inicio`}
                rotulo="Abre"
                descricao={`${NOMES_DIAS[i]}: abre às`}
                valor={dia.inicio}
                desabilitado={!editavel}
                onChange={(inicio) => mudar(i, { inicio })}
              />
              <CampoHora
                id={`semana-${i}-fim`}
                rotulo="Fecha"
                descricao={`${NOMES_DIAS[i]}: fecha às`}
                valor={dia.fim}
                desabilitado={!editavel}
                onChange={(fim) => mudar(i, { fim })}
              />
            </div>
          )}
          {dia.aberto && (
            <div className="w-full space-y-2">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(dia.pausaInicio)}
                  disabled={!editavel}
                  onChange={(e) =>
                    mudar(i, e.target.checked ? PAUSA_SUGERIDA : { pausaInicio: null, pausaFim: null })
                  }
                  className="size-5"
                />
                Pausa no meio do dia (ex.: almoço)
              </label>
              {dia.pausaInicio && (
                <div className="flex w-full flex-wrap gap-2">
                  <CampoHora
                    id={`semana-${i}-pausa-inicio`}
                    rotulo="Pausa das"
                    descricao={`${NOMES_DIAS[i]}: pausa começa às`}
                    valor={dia.pausaInicio}
                    desabilitado={!editavel}
                    onChange={(pausaInicio) => mudar(i, { pausaInicio })}
                  />
                  <CampoHora
                    id={`semana-${i}-pausa-fim`}
                    rotulo="Volta às"
                    descricao={`${NOMES_DIAS[i]}: pausa termina às`}
                    valor={dia.pausaFim ?? ""}
                    desabilitado={!editavel}
                    onChange={(pausaFim) => mudar(i, { pausaFim })}
                  />
                </div>
              )}
            </div>
          )}
          {erroDoDia(dia) && (
            <span className="flex items-center gap-1 text-sm text-red-700">
              <AlertCircle aria-hidden="true" size={16} /> {erroDoDia(dia)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function HorariosPage() {
  const [dados, setDados] = useState<DadosHorarios | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [ehDono, setEhDono] = useState(false);
  const [alvo, setAlvo] = useState(BARBEARIA);
  const [semanaEditada, setSemanaEditada] = useState<Semana | null>(null);
  const [diaForm, setDiaForm] = useState<DiaForm>(diaVazio);
  const [perguntandoAlcance, setPerguntandoAlcance] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [avisar, setAvisar] = useState<{ descricao: string; afetados: Afetado[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados((await authFetch("/horarios")) as DadosHorarios);
      setErroCarga(null);
    } catch (e) {
      setErroCarga(e instanceof Error ? e.message : "Não foi possível carregar os horários.");
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    queueMicrotask(() => {
      if (!ativo) return;
      setEhDono(decodeToken(getToken() ?? "")?.papel === "DONO");
      void carregar();
    });
    return () => {
      ativo = false;
    };
  }, [carregar]);

  const profissional = dados?.profissionais.find((p) => p.id === alvo) ?? null;
  const nomeAlvo = profissional?.nome ?? "a barbearia";
  const profissionalId = alvo === BARBEARIA ? null : alvo;
  /** Semana em vigor para o alvo (profissional sem semana própria segue a barbearia). */
  const semanaAtual = useMemo<Semana | null>(() => {
    if (!dados) return null;
    return profissional ? (profissional.semana ?? dados.barbearia.semana) : dados.barbearia.semana;
  }, [dados, profissional]);
  const segueBarbearia = Boolean(profissional && !profissional.semana);
  const semanaNaTela = semanaEditada ?? semanaAtual;

  function trocarAlvo(novo: string) {
    setAlvo(novo);
    setSemanaEditada(null);
    setErroAcao(null);
  }

  /** Simula; sem ninguém afetado aplica direto, senão abre a lista para confirmar. */
  async function proporMudanca(mudanca: Mudanca, descricao: string) {
    setErroAcao(null);
    setProcessando(true);
    try {
      const { afetados } = (await authFetch("/horarios/simular", {
        method: "POST",
        body: JSON.stringify(mudanca),
      })) as { afetados: Afetado[] };
      if (afetados.length > 0) {
        setPendente({ mudanca, descricao, afetados });
        return;
      }
      await aplicar(mudanca, descricao, false);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível aplicar a mudança.");
    } finally {
      setProcessando(false);
    }
  }

  async function aplicar(mudanca: Mudanca, descricao: string, confirmarCancelamento: boolean) {
    try {
      const { cancelados } = (await authFetch("/horarios/aplicar", {
        method: "POST",
        body: JSON.stringify({ ...mudanca, confirmarCancelamento }),
      })) as { cancelados: Afetado[] };
      setPendente(null);
      setSemanaEditada(null);
      setDiaForm(diaVazio());
      if (cancelados.length > 0) setAvisar({ descricao, afetados: cancelados });
      setToast(descricao);
      await carregar();
    } catch (e) {
      // Alguém marcou horário entre a simulação e a confirmação: mostra a lista atualizada
      const afetados = (e as ErroComAfetados).dados?.afetados;
      if (afetados?.length) {
        setPendente({ mudanca, descricao, afetados });
        return;
      }
      throw e;
    }
  }

  function salvarSemana() {
    if (!semanaEditada || !semanaValida(semanaEditada)) return;
    void proporMudanca(
      { tipo: "semana", profissionalId, semana: semanaEditada },
      `Nova semana padrão de ${nomeAlvo} (vale para todas as semanas)`,
    );
  }

  function enviarDia(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroAcao(null);
    if (!diaForm.data || diaForm.data < hojeNoFuso()) {
      setErroAcao("Escolha uma data de hoje em diante.");
      return;
    }
    if (!diaForm.fechado && diaForm.inicio >= diaForm.fim) {
      setErroAcao("O início precisa ser antes do fim.");
      return;
    }
    if (
      !diaForm.fechado &&
      diaForm.comPausa &&
      !pausaValida(diaForm.inicio, diaForm.fim, diaForm.pausaInicio, diaForm.pausaFim)
    ) {
      setErroAcao("A pausa precisa ficar dentro do horário do dia.");
      return;
    }
    // A pergunta do alcance: só neste dia ou a regra fixa da semana?
    setPerguntandoAlcance(true);
  }

  function aplicarDia(alcance: "dia" | "semana") {
    setPerguntandoAlcance(false);
    const pausa =
      !diaForm.fechado && diaForm.comPausa
        ? { pausaInicio: diaForm.pausaInicio, pausaFim: diaForm.pausaFim }
        : { pausaInicio: null, pausaFim: null };
    const textoPausa = pausa.pausaInicio ? `, pausa ${pausa.pausaInicio}–${pausa.pausaFim}` : "";
    const situacao = diaForm.fechado ? "fechado" : `das ${diaForm.inicio} às ${diaForm.fim}${textoPausa}`;
    if (alcance === "dia") {
      void proporMudanca(
        {
          tipo: "excecao",
          profissionalId,
          data: diaForm.data,
          fechado: diaForm.fechado,
          ...(diaForm.fechado ? {} : { inicio: diaForm.inicio, fim: diaForm.fim }),
          ...(pausa.pausaInicio && pausa.pausaFim ? { pausaInicio: pausa.pausaInicio, pausaFim: pausa.pausaFim } : {}),
          motivo: diaForm.motivo.trim() || undefined,
        },
        `${profissional ? profissional.nome : "Barbearia"}: ${dataCurta(diaForm.data)} ${situacao}`,
      );
      return;
    }
    if (!semanaAtual) return;
    const atual = semanaAtual[diaDaSemana(diaForm.data)];
    // Fechado na semana: mantém os horários de antes guardados, para reabrir depois
    const semana = semanaComDia(
      semanaAtual,
      diaDaSemana(diaForm.data),
      diaForm.fechado
        ? { ...atual, aberto: false }
        : { aberto: true, inicio: diaForm.inicio, fim: diaForm.fim, ...pausa },
    );
    void proporMudanca(
      { tipo: "semana", profissionalId, semana },
      `${profissional ? profissional.nome : "Barbearia"}: ${todaSemanaDe(diaForm.data)} ${situacao}`,
    );
  }

  if (erroCarga) {
    return (
      <p role="alert" className="flex items-center gap-2 text-base text-red-700">
        <AlertCircle aria-hidden="true" size={20} /> {erroCarga}
      </p>
    );
  }
  if (!dados || !semanaNaTela) {
    return <div aria-busy="true" className="h-40 animate-pulse rounded-lg bg-zinc-100 motion-reduce:animate-none" />;
  }

  const excecoesDoAlvo = dados.excecoes.filter((e) => e.profissionalId === profissionalId);
  const editandoSemana = ehDono && (!segueBarbearia || semanaEditada !== null);

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <header>
        <h1 className="text-2xl font-semibold leading-8">Horários de funcionamento</h1>
        <p className="mt-1 text-base leading-6 text-zinc-700">
          A página de agendamento só oferece horários dentro do expediente. Cada profissional segue a
          barbearia, a menos que tenha horário próprio ou folga.
        </p>
        {!ehDono && <p className="mt-2 text-sm text-zinc-600">Só o dono pode mudar os horários. Você pode visualizá-los.</p>}
      </header>

      <div role="tablist" aria-label="De quem é o horário" className="flex flex-wrap gap-2">
        {[{ id: BARBEARIA, nome: "Barbearia" }, ...dados.profissionais].map((op) => (
          <button
            key={op.id}
            role="tab"
            type="button"
            aria-selected={alvo === op.id}
            onClick={() => trocarAlvo(op.id)}
            className={`min-h-11 rounded-full border px-4 text-base font-medium ${alvo === op.id ? "border-amber-500 bg-amber-500 text-zinc-950" : "border-zinc-300 hover:bg-zinc-50"}`}
          >
            {op.nome}
          </button>
        ))}
      </div>

      {erroAcao && (
        <p role="alert" className="flex items-center gap-2 text-base text-red-700">
          <AlertCircle aria-hidden="true" size={20} /> {erroAcao}
        </p>
      )}

      <section aria-labelledby="semana-titulo" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="semana-titulo" className="text-lg font-semibold">
              Semana padrão {profissional ? `de ${profissional.nome}` : "da barbearia"}
            </h2>
            <p className="text-sm text-zinc-600">
              {segueBarbearia && semanaEditada === null
                ? "Segue o horário da barbearia."
                : "Vale para todas as semanas, exceto nos dias com exceção."}
            </p>
          </div>
          {ehDono && profissional && segueBarbearia && semanaEditada === null && (
            <button type="button" onClick={() => setSemanaEditada(dados.barbearia.semana)} className={BOTAO_SECUNDARIO}>
              Definir horário próprio
            </button>
          )}
          {ehDono && profissional && !segueBarbearia && (
            <button
              type="button"
              disabled={processando}
              onClick={() =>
                void proporMudanca(
                  { tipo: "semana", profissionalId, semana: null },
                  `${profissional.nome} volta a seguir o horário da barbearia`,
                )
              }
              className={BOTAO_SECUNDARIO}
            >
              Voltar a seguir a barbearia
            </button>
          )}
        </div>

        <TabelaSemana semana={semanaNaTela} editavel={editandoSemana} onChange={setSemanaEditada} />

        {semanaEditada && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={salvarSemana}
              disabled={processando || !semanaValida(semanaEditada)}
              className={BOTAO_PRIMARIO}
            >
              {processando && <Loader2 aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" />}
              Salvar semana
            </button>
            <button type="button" onClick={() => setSemanaEditada(null)} disabled={processando} className={BOTAO_SECUNDARIO}>
              Descartar
            </button>
          </div>
        )}
        {profissional && (
          <p className="text-sm text-zinc-600">
            O horário do profissional nunca passa do horário da barbearia: se ela abre às 9h, ninguém atende às 8h.
          </p>
        )}
      </section>

      {ehDono && (
        <section aria-labelledby="dia-titulo" className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <h2 id="dia-titulo" className="text-lg font-semibold">
            Mudar um dia {profissional ? `de ${profissional.nome}` : "da barbearia"}
          </h2>
          <p className="text-sm text-zinc-600">
            Ex.: &quot;dia 10 não vou trabalhar&quot; ou &quot;dia 10 só das 14h às 18h&quot;. Depois você escolhe se vale só para
            esse dia ou para toda semana.
          </p>
          <form onSubmit={enviarDia} noValidate className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full space-y-1 sm:w-auto">
                <label htmlFor="dia-data" className="block text-sm font-semibold">
                  Data
                </label>
                <input
                  id="dia-data"
                  type="date"
                  min={hojeNoFuso()}
                  value={diaForm.data}
                  onChange={(e) => setDiaForm((f) => ({ ...f, data: e.target.value }))}
                  className={`${CAMPO} w-full min-w-0`}
                />
              </div>
              <fieldset className="space-y-1">
                <legend className="text-sm font-semibold">Nesse dia</legend>
                <div className="flex flex-wrap gap-2">
                  {[
                    { valor: true, rotulo: "Fechado" },
                    { valor: false, rotulo: "Horário especial" },
                  ].map((op) => (
                    <label
                      key={op.rotulo}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 ${diaForm.fechado === op.valor ? "border-zinc-950 bg-zinc-50" : "border-zinc-300"}`}
                    >
                      <input
                        type="radio"
                        name="dia-situacao"
                        checked={diaForm.fechado === op.valor}
                        onChange={() => setDiaForm((f) => ({ ...f, fechado: op.valor }))}
                      />
                      {op.rotulo}
                    </label>
                  ))}
                </div>
              </fieldset>
              {!diaForm.fechado && (
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <CampoHora
                    id="dia-inicio"
                    rotulo="Das"
                    valor={diaForm.inicio}
                    onChange={(inicio) => setDiaForm((f) => ({ ...f, inicio }))}
                  />
                  <CampoHora
                    id="dia-fim"
                    rotulo="Às"
                    valor={diaForm.fim}
                    onChange={(fim) => setDiaForm((f) => ({ ...f, fim }))}
                  />
                </div>
              )}
            </div>
            {!diaForm.fechado && (
              <div className="space-y-2">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={diaForm.comPausa}
                    onChange={(e) => setDiaForm((f) => ({ ...f, comPausa: e.target.checked }))}
                    className="size-5"
                  />
                  Pausa no meio do dia (ex.: almoço)
                </label>
                {diaForm.comPausa && (
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <CampoHora
                      id="dia-pausa-inicio"
                      rotulo="Pausa das"
                      valor={diaForm.pausaInicio}
                      onChange={(pausaInicio) => setDiaForm((f) => ({ ...f, pausaInicio }))}
                    />
                    <CampoHora
                      id="dia-pausa-fim"
                      rotulo="Volta às"
                      valor={diaForm.pausaFim}
                      onChange={(pausaFim) => setDiaForm((f) => ({ ...f, pausaFim }))}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="dia-motivo" className="block text-sm font-semibold">
                Motivo <span className="font-normal text-zinc-600">(opcional, só para você)</span>
              </label>
              <input
                id="dia-motivo"
                value={diaForm.motivo}
                maxLength={100}
                placeholder="Ex.: feriado, consulta médica"
                onChange={(e) => setDiaForm((f) => ({ ...f, motivo: e.target.value }))}
                className={`${CAMPO} w-full`}
              />
            </div>

            {perguntandoAlcance ? (
              <div role="group" aria-labelledby="alcance-titulo" className="space-y-3 rounded-md border border-zinc-300 bg-zinc-50 p-3">
                <p id="alcance-titulo" className="font-semibold">
                  Essa mudança vale para:
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => aplicarDia("dia")} className={BOTAO_PRIMARIO}>
                    Só em {dataCurta(diaForm.data)}
                  </button>
                  <button type="button" onClick={() => aplicarDia("semana")} className={BOTAO_SECUNDARIO}>
                    {primeiraMaiuscula(todaSemanaDe(diaForm.data))} (regra fixa)
                  </button>
                  <button type="button" onClick={() => setPerguntandoAlcance(false)} className="min-h-11 px-3 text-base underline">
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <button type="submit" disabled={processando} className={BOTAO_PRIMARIO}>
                {processando && <Loader2 aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" />}
                Continuar
              </button>
            )}
          </form>
        </section>
      )}

      <section aria-labelledby="excecoes-titulo" className="space-y-3">
        <h2 id="excecoes-titulo" className="text-lg font-semibold">
          Próximos dias com exceção {profissional ? `de ${profissional.nome}` : "da barbearia"}
        </h2>
        {excecoesDoAlvo.length === 0 ? (
          <p className="flex items-center gap-2 text-base text-zinc-600">
            <CalendarOff aria-hidden="true" size={18} /> Nenhuma. Todos os dias seguem a semana padrão.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
            {excecoesDoAlvo.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold">
                    {dataCurta(e.data)} · {descreverExcecao(e)}
                  </p>
                  <p className="text-sm text-zinc-600">
                    No lugar de: {descreverDia(semanaAtual?.[diaDaSemana(e.data)] ?? semanaNaTela[0])}
                    {e.motivo ? ` · ${e.motivo}` : ""}
                  </p>
                </div>
                {ehDono && (
                  <button
                    type="button"
                    disabled={processando}
                    onClick={() =>
                      void proporMudanca(
                        { tipo: "remover-excecao", excecaoId: e.id },
                        `Exceção de ${dataCurta(e.data)} removida; o dia volta ao horário padrão`,
                      )
                    }
                    className="flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 aria-hidden="true" size={18} /> Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendente && (
        <AfetadosDialog
          modo="confirmar"
          descricao={pendente.descricao}
          afetados={pendente.afetados}
          onFechar={() => setPendente(null)}
          onConfirmar={() => aplicar(pendente.mudanca, pendente.descricao, true)}
        />
      )}
      {avisar && (
        <AfetadosDialog modo="avisar" descricao={avisar.descricao} afetados={avisar.afetados} onFechar={() => setAvisar(null)} />
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
