"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Trash2, X } from "lucide-react";
import type { Agendamento, Cliente, Servico } from "@/lib/types";

/** Mesmas opções da tela de concluir agendamento (FormaPagamentoDialog). */
const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Não informado"];
const SEM_CADASTRO = "";
const FUSO = "America/Sao_Paulo";
const OFFSET_FUSO = "-03:00";
const CENTAVOS = 100;
const CASAS = 2;

export type CorrecaoAtendimento = {
  data: string;
  clienteId: string | null;
  clienteNome?: string;
  servicoId: string;
  profissionalNome: string;
  valorCentavos: number;
  formaPagamento: string;
};

type Campo = "data" | "hora" | "clienteNome" | "valor";
type Erros = Partial<Record<Campo, string>>;

/** "2026-11-10" no horário de Brasília. */
function diaLocal(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/** "09:00" no horário de Brasília. */
function horaLocal(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}

function centavosParaTexto(centavos: number) {
  return (centavos / CENTAVOS).toFixed(CASAS).replace(".", ",");
}

/** "45", "45,00", "1.234,50" e "R$ 45" viram centavos; texto que não é número vira NaN. */
function textoParaCentavos(texto: string) {
  const semMoeda = texto
    .trim()
    // Tira o "R$" e espaços: "R$ 45,00" vira "45,00".
    // https://regex101.com/?flavor=javascript&flags=gi&regex=r%5C%24%7C%5Cs&testString=R%24%2045%2C00
    .replace(/r\$|\s/gi, "");
  if (!semMoeda) return Number.NaN;
  // Pontos de milhar saem e a vírgula vira ponto: "1.234,50" vira "1234.50".
  // https://regex101.com/?flavor=javascript&flags=g&regex=%5C.&testString=1.234%2C50
  const numero = Number(semMoeda.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? Math.round(numero * CENTAVOS) : Number.NaN;
}

const campoClasse =
  "min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2";

function MensagemErro({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <p id={id} className="flex items-center gap-2 text-base leading-6 text-red-700">
      <AlertCircle aria-hidden="true" size={16} />
      {texto}
    </p>
  );
}

export default function AtendimentoImportadoDrawer({
  atendimento,
  clientes,
  servicos,
  profissionais,
  onClose,
  onSave,
  onExcluir,
}: {
  atendimento: Agendamento;
  clientes: Cliente[];
  servicos: Servico[];
  /** Nomes de profissionais já usados, para sugerir no campo. */
  profissionais: string[];
  onClose: () => void;
  onSave: (correcao: CorrecaoAtendimento) => Promise<void>;
  onExcluir: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const original = atendimento.importacao;
  const [form, setForm] = useState({
    data: diaLocal(atendimento.inicio),
    hora: horaLocal(atendimento.inicio),
    clienteId: atendimento.clienteId ?? SEM_CADASTRO,
    clienteNome: atendimento.clienteNome,
    servicoId: atendimento.servicoId,
    profissionalNome: original?.profissionalNome ?? "",
    valor: centavosParaTexto(original?.valorCentavos ?? atendimento.servico.precoCentavos),
    formaPagamento: original?.formaPagamento ?? "Não informado",
  });
  const [erros, setErros] = useState<Erros>({});
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function fechar() {
    dialogRef.current?.close();
    onClose();
  }

  const atualizar = (campo: keyof typeof form, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));

  // Forma de pagamento vinda da planilha que não está na lista (ex.: "VR") continua escolhível
  const formasDisponiveis = FORMAS_PAGAMENTO.includes(form.formaPagamento)
    ? FORMAS_PAGAMENTO
    : [form.formaPagamento, ...FORMAS_PAGAMENTO];

  function validar(): Erros {
    const centavos = textoParaCentavos(form.valor);
    return {
      data: form.data ? undefined : "Informe o dia",
      hora: form.hora ? undefined : "Informe o horário",
      clienteNome: form.clienteId === SEM_CADASTRO && !form.clienteNome.trim() ? "Informe o nome do cliente" : undefined,
      valor: Number.isNaN(centavos) || centavos < 0 ? "Informe um valor válido, ex.: 45,00" : undefined,
    };
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroApi(null);
    const novos = validar();
    setErros(novos);
    const primeiro = (Object.keys(novos) as Campo[]).find((campo) => novos[campo]);
    if (primeiro) {
      document.getElementById(`importado-${primeiro}`)?.focus();
      return;
    }
    setSalvando(true);
    try {
      await onSave({
        data: `${form.data}T${form.hora}:00${OFFSET_FUSO}`,
        clienteId: form.clienteId || null,
        clienteNome: form.clienteId ? undefined : form.clienteNome.trim(),
        servicoId: form.servicoId,
        profissionalNome: form.profissionalNome.trim(),
        valorCentavos: textoParaCentavos(form.valor),
        formaPagamento: form.formaPagamento,
      });
    } catch (error) {
      setErroApi(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    setErroApi(null);
    setExcluindo(true);
    try {
      await onExcluir();
    } catch (error) {
      setErroApi(error instanceof Error ? error.message : "Não foi possível excluir.");
      setConfirmandoExclusao(false);
    } finally {
      setExcluindo(false);
    }
  }

  const ocupado = salvando || excluindo;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="importado-titulo"
      onCancel={(event) => {
        event.preventDefault();
        fechar();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) fechar();
      }}
      className="app-drawer fixed inset-x-0 bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-0 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40 md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-full md:w-[28rem] md:rounded-t-none md:rounded-l-2xl"
    >
      <div className="flex min-h-full flex-col">
        <header className="flex items-start justify-between border-b border-zinc-200 p-6">
          <div>
            <h2 id="importado-titulo" className="text-2xl font-semibold leading-8">
              Corrigir atendimento
            </h2>
            <p className="mt-1 text-base leading-6 text-zinc-700">
              Veio da importação de planilha. A correção vale também para o Financeiro.
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar formulário"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <form noValidate onSubmit={salvar} className="flex flex-1 flex-col gap-5 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="importado-data" className="text-base font-semibold">
                Dia
              </label>
              <input
                id="importado-data"
                type="date"
                value={form.data}
                onChange={(e) => atualizar("data", e.target.value)}
                aria-invalid={Boolean(erros.data)}
                aria-describedby={erros.data ? "importado-data-erro" : undefined}
                className={campoClasse}
              />
              <MensagemErro id="importado-data-erro" texto={erros.data} />
            </div>
            <div className="space-y-2">
              <label htmlFor="importado-hora" className="text-base font-semibold">
                Horário
              </label>
              <input
                id="importado-hora"
                type="time"
                value={form.hora}
                onChange={(e) => atualizar("hora", e.target.value)}
                aria-invalid={Boolean(erros.hora)}
                aria-describedby={erros.hora ? "importado-hora-erro" : undefined}
                className={`${campoClasse} tabular-nums`}
              />
              <MensagemErro id="importado-hora-erro" texto={erros.hora} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="importado-cliente" className="text-base font-semibold">
              Cliente
            </label>
            <select
              id="importado-cliente"
              value={form.clienteId}
              onChange={(e) => atualizar("clienteId", e.target.value)}
              className={`campo-select ${campoClasse} bg-white`}
            >
              <option value={SEM_CADASTRO}>Sem cadastro (só o nome)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {form.clienteId === SEM_CADASTRO && (
              <>
                <label htmlFor="importado-clienteNome" className="sr-only">
                  Nome do cliente
                </label>
                <input
                  id="importado-clienteNome"
                  value={form.clienteNome}
                  placeholder="Nome do cliente"
                  onChange={(e) => atualizar("clienteNome", e.target.value)}
                  aria-invalid={Boolean(erros.clienteNome)}
                  aria-describedby={erros.clienteNome ? "importado-clienteNome-erro" : undefined}
                  className={campoClasse}
                />
                <MensagemErro id="importado-clienteNome-erro" texto={erros.clienteNome} />
              </>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="importado-servico" className="text-base font-semibold">
              Serviço
            </label>
            <select
              id="importado-servico"
              value={form.servicoId}
              onChange={(e) => atualizar("servicoId", e.target.value)}
              className={`campo-select ${campoClasse} bg-white`}
            >
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ativo ? s.nome : `${s.nome} (desativado)`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="importado-profissional" className="text-base font-semibold">
              Profissional <span className="font-normal text-zinc-700">(opcional)</span>
            </label>
            <input
              id="importado-profissional"
              list="importado-profissionais"
              value={form.profissionalNome}
              onChange={(e) => atualizar("profissionalNome", e.target.value)}
              className={campoClasse}
            />
            <datalist id="importado-profissionais">
              {profissionais.map((nome) => (
                <option key={nome} value={nome} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="importado-valor" className="text-base font-semibold">
                Valor pago <span className="font-normal text-zinc-700">(R$)</span>
              </label>
              <input
                id="importado-valor"
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => atualizar("valor", e.target.value)}
                aria-invalid={Boolean(erros.valor)}
                aria-describedby={erros.valor ? "importado-valor-erro" : undefined}
                className={`${campoClasse} tabular-nums`}
              />
              <MensagemErro id="importado-valor-erro" texto={erros.valor} />
            </div>
            <div className="space-y-2">
              <label htmlFor="importado-pagamento" className="text-base font-semibold">
                Pagamento
              </label>
              <select
                id="importado-pagamento"
                value={form.formaPagamento}
                onChange={(e) => atualizar("formaPagamento", e.target.value)}
                className={`campo-select ${campoClasse} bg-white`}
              >
                {formasDisponiveis.map((forma) => (
                  <option key={forma} value={forma}>
                    {forma}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {erroApi && (
            <p role="alert" className="flex items-center gap-2 text-base leading-6 text-red-700">
              <AlertCircle aria-hidden="true" size={20} />
              {erroApi}
            </p>
          )}

          <div className="mt-auto space-y-3 border-t border-zinc-200 pt-6">
            {confirmandoExclusao ? (
              <div role="alert" className="space-y-3 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-base leading-6 text-red-900">
                  Excluir este atendimento? Ele sai da agenda e do Financeiro. Não dá para desfazer.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void excluir()}
                    disabled={ocupado}
                    className="flex min-h-11 items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-base font-semibold text-white hover:bg-red-800 disabled:opacity-70"
                  >
                    {excluindo && <Loader2 aria-hidden="true" size={20} className="animate-spin motion-reduce:animate-none" />}
                    {excluindo ? "Excluindo…" : "Sim, excluir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(false)}
                    disabled={ocupado}
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-4 py-2 text-base font-semibold hover:bg-zinc-50"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setConfirmandoExclusao(true)}
                  disabled={ocupado}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-base font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 aria-hidden="true" size={18} />
                  Excluir
                </button>
                <button
                  type="submit"
                  disabled={ocupado}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {salvando && <Loader2 aria-hidden="true" size={20} className="animate-spin motion-reduce:animate-none" />}
                  {salvando ? "Salvando…" : "Salvar correção"}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </dialog>
  );
}
