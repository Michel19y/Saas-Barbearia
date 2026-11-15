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
} from "@/lib/horarios";

const BARBEARIA = "barbearia";
const CAMPO =
  "min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:bg-zinc-100 disabled:text-zinc-500";
const BOTAO_PRIMARIO =
  "flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";
const BOTAO_SECUNDARIO =
  "min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-base font-semibold hover:bg-zinc-50 disabled:opacity-60";

type Pendente = { mudanca: Mudanca; descricao: string; afetados: Afetado[] };
type DiaForm = { data: string; fechado: boolean; inicio: string; fim: string; motivo: string };

const diaVazio = (): DiaForm => ({ data: hojeNoFuso(), fechado: true, inicio: "14:00", fim: "18:00", motivo: "" });
const semanaValida = (semana: Semana) => semana.every((d) => !d.aberto || d.inicio < d.fim);

/** Erro 409 da API quando a mudança cancelaria agendamentos (o corpo traz a lista). */
type ErroComAfetados = Error & { dados?: { afetados?: Afetado[] } };

const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Campo de hora com rótulo em cima. No Android o campo de hora tem uma largura mínima
 * própria (com a setinha) e não encolhe; por isso cada campo tem esse mínimo e, se os dois
 * não couberem lado a lado, o segundo desce para a linha de baixo em vez de vazar do card.
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
  return (
    <label htmlFor={id} className="flex min-w-[10.5rem] flex-1 flex-col gap-1">
      <span className="text-sm font-medium text-zinc-700">{rotulo}</span>
      <input
        id={id}
        type="time"
        value={valor}
        disabled={desabilitado}
        aria-label={descricao}
        onChange={(e) => onChange(e.target.value)}
        // pr-4: a setinha do Android não fica colada na borda
        className={`${CAMPO} w-full max-w-full pr-4 tabular-nums`}
      />
    </label>
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
          {dia.aberto && dia.inicio >= dia.fim && (
            <span className="flex items-center gap-1 text-sm text-red-700">
              <AlertCircle aria-hidden="true" size={16} /> O início precisa ser antes do fim
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
    // A pergunta do alcance: só neste dia ou a regra fixa da semana?
    setPerguntandoAlcance(true);
  }

  function aplicarDia(alcance: "dia" | "semana") {
    setPerguntandoAlcance(false);
    const situacao = diaForm.fechado ? "fechado" : `das ${diaForm.inicio} às ${diaForm.fim}`;
    if (alcance === "dia") {
      void proporMudanca(
        {
          tipo: "excecao",
          profissionalId,
          data: diaForm.data,
          fechado: diaForm.fechado,
          ...(diaForm.fechado ? {} : { inicio: diaForm.inicio, fim: diaForm.fim }),
          motivo: diaForm.motivo.trim() || undefined,
        },
        `${profissional ? profissional.nome : "Barbearia"}: ${dataCurta(diaForm.data)} ${situacao}`,
      );
      return;
    }
    if (!semanaAtual) return;
    const semana = semanaComDia(semanaAtual, diaDaSemana(diaForm.data), {
      aberto: !diaForm.fechado,
      inicio: diaForm.fechado ? semanaAtual[diaDaSemana(diaForm.data)].inicio : diaForm.inicio,
      fim: diaForm.fechado ? semanaAtual[diaDaSemana(diaForm.data)].fim : diaForm.fim,
    });
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
            className={`min-h-11 rounded-full border px-4 text-base font-medium ${alvo === op.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 hover:bg-zinc-50"}`}
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
