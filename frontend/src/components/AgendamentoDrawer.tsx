"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import type { Agendamento, Cliente, Servico } from "@/lib/types";

export type AgendamentoFormValues = {
  clienteId: string;
  clienteNome: string;
  servicoIds: string[];
  inicio: string;
  observacao: string;
};

type Campo =
  | "clienteId"
  | "clienteNome"
  | "servicoIds"
  | "inicio"
  | "observacao";
type ErrosCampos = Partial<Record<Campo, string>>;
type ModoCliente = "cadastrado" | "rapido";

type AgendamentoDrawerProps = {
  agendamento: Agendamento | null;
  dataInicial: string;
  clientes: Cliente[];
  servicos: Servico[];
  onClose: () => void;
  onSave: (values: AgendamentoFormValues) => Promise<void>;
};

function paraDatetimeLocal(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const pad = (numero: number) => String(numero).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function inicioInicial(data: string) {
  const agora = new Date();
  const pad = (numero: number) => String(numero).padStart(2, "0");
  return `${data}T${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
}

function validarCampo(
  campo: Campo,
  valor: string | string[],
  servicos: Servico[],
  modoCliente: ModoCliente,
) {
  if (campo === "clienteId" && modoCliente === "cadastrado" && !valor) {
    return "Selecione um cliente";
  }
  if (
    campo === "clienteNome" &&
    modoCliente === "rapido" &&
    typeof valor === "string" &&
    valor.trim().length < 2
  ) {
    return "Informe uma identificação (mínimo 2 letras)";
  }
  if (campo === "servicoIds") {
    const ids = valor as string[];
    if (ids.length === 0) return "Selecione ao menos um serviço";
    if (!ids.every((id) => servicos.some((servico) => servico.id === id))) {
      return "Selecione apenas serviços ativos";
    }
  }
  if (campo === "inicio" && !valor) return "Informe a data e o horário";
  return undefined;
}

function formatarPreco(precoCentavos: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(precoCentavos / 100);
}

function formatarHoraLocal(datetimeLocal: string) {
  const data = new Date(datetimeLocal);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export default function AgendamentoDrawer({
  agendamento,
  dataInicial,
  clientes,
  servicos,
  onClose,
  onSave,
}: AgendamentoDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const clienteRef = useRef<HTMLSelectElement>(null);
  const clienteRapidoRef = useRef<HTMLInputElement>(null);
  const ehEdicao = Boolean(agendamento);
  const [modoCliente, setModoCliente] = useState<ModoCliente>(
    agendamento?.clienteId ? "cadastrado" : "rapido",
  );
  const [form, setForm] = useState<AgendamentoFormValues>({
    clienteId: agendamento?.clienteId ?? "",
    clienteNome:
      agendamento?.clienteNome ?? agendamento?.cliente?.nome ?? "",
    servicoIds:
      agendamento &&
      servicos.some((servico) => servico.id === agendamento.servicoId)
        ? [agendamento.servicoId]
        : [],
    inicio: agendamento
      ? paraDatetimeLocal(agendamento.inicio)
      : inicioInicial(dataInicial),
    observacao: agendamento?.observacao ?? "",
  });
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const frame = window.requestAnimationFrame(() => {
      const campoCliente = clienteRef.current ?? clienteRapidoRef.current;
      campoCliente?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
    };
  }, []);

  function fechar() {
    dialogRef.current?.close();
    onClose();
  }

  function validarFormulario() {
    const novosErros: ErrosCampos = {};
    const campos: Campo[] = [
      modoCliente === "cadastrado" ? "clienteId" : "clienteNome",
      "servicoIds",
      "inicio",
    ];
    for (const campo of campos) {
      const erro = validarCampo(campo, form[campo], servicos, modoCliente);
      if (erro) novosErros[campo] = erro;
    }
    setErros(novosErros);
    return Object.keys(novosErros)[0] as Campo | undefined;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroApi(null);
    const primeiroErro = validarFormulario();
    if (primeiroErro) {
      document.getElementById(`agendamento-${primeiroErro}`)?.focus();
      return;
    }

    if (!ehEdicao) {
      setMostrarConfirmacao(true);
      return;
    }

    void confirmarEnvio();
  }

  async function confirmarEnvio() {
    setSalvando(true);
    setErroApi(null);
    try {
      await onSave({
        ...form,
        clienteId: modoCliente === "cadastrado" ? form.clienteId : "",
        clienteNome:
          modoCliente === "rapido" ? form.clienteNome.trim() : "",
        observacao: form.observacao.trim(),
      });
    } catch (error) {
      setMostrarConfirmacao(false);
      setErroApi(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o agendamento.",
      );
    } finally {
      setSalvando(false);
    }
  }

  function atualizarCampo<C extends Campo>(
    campo: C,
    valor: AgendamentoFormValues[C],
  ) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErros((atuais) =>
      atuais[campo]
        ? {
            ...atuais,
            [campo]: validarCampo(campo, valor, servicos, modoCliente),
          }
        : atuais,
    );
  }

  function alternarServico(id: string) {
    const selecionado = form.servicoIds.includes(id);
    const proximos = ehEdicao
      ? [id]
      : selecionado
        ? form.servicoIds.filter((atual) => atual !== id)
        : [...form.servicoIds, id];
    atualizarCampo("servicoIds", proximos);
  }

  function campoInvalido(campo: Campo) {
    return Boolean(erros[campo]);
  }

  const servicosSelecionados = servicos.filter((servico) =>
    form.servicoIds.includes(servico.id),
  );
  const duracaoTotal = servicosSelecionados.reduce(
    (soma, servico) => soma + servico.duracaoMin,
    0,
  );
  const precoTotal = servicosSelecionados.reduce(
    (soma, servico) => soma + servico.precoCentavos,
    0,
  );
  const horaFim =
    form.inicio && duracaoTotal > 0
      ? formatarHoraLocal(
          new Date(
            new Date(form.inicio).getTime() + duracaoTotal * 60000,
          ).toISOString(),
        )
      : null;
  const nomeParaConfirmacao =
    modoCliente === "cadastrado"
      ? clientes.find((cliente) => cliente.id === form.clienteId)?.nome
      : form.clienteNome.trim();

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="agendamento-drawer-titulo"
        onCancel={(event) => {
          event.preventDefault();
          fechar();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !salvando) fechar();
        }}
        className="app-drawer fixed inset-x-0 bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-0 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40 md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-full md:w-[28rem] md:rounded-t-none md:rounded-l-2xl"
      >
        <div className="flex min-h-full flex-col">
          <header className="flex items-start justify-between border-b border-zinc-200 p-6">
            <div>
              <h2
                id="agendamento-drawer-titulo"
                className="text-2xl font-semibold leading-8"
              >
                {agendamento ? "Editar agendamento" : "Novo agendamento"}
              </h2>
              <p className="mt-1 text-base leading-6 text-zinc-700">
                {ehEdicao
                  ? "Escolha o cliente, o serviço e um horário."
                  : "Escolha o cliente, um ou mais serviços e o horário."}
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

          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-6 p-6"
          >
            <div className="space-y-3">
              <p className="text-base font-semibold">Quem será atendido?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={modoCliente === "cadastrado"}
                  onClick={() => {
                    setModoCliente("cadastrado");
                    setErros((atuais) => ({
                      ...atuais,
                      clienteId: undefined,
                      clienteNome: undefined,
                    }));
                  }}
                  className={`min-h-11 rounded-md border px-3 py-2 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 ${modoCliente === "cadastrado" ? "border-zinc-950 bg-zinc-100" : "border-zinc-300 bg-white"}`}
                >
                  Cliente cadastrado
                </button>
                <button
                  type="button"
                  aria-pressed={modoCliente === "rapido"}
                  onClick={() => {
                    setModoCliente("rapido");
                    setErros((atuais) => ({
                      ...atuais,
                      clienteId: undefined,
                      clienteNome: undefined,
                    }));
                  }}
                  className={`min-h-11 rounded-md border px-3 py-2 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 ${modoCliente === "rapido" ? "border-zinc-950 bg-zinc-100" : "border-zinc-300 bg-white"}`}
                >
                  Anotação rápida
                </button>
              </div>
              {modoCliente === "cadastrado" ? (
                <>
                  <label
                    htmlFor="agendamento-clienteId"
                    className="block text-base font-semibold"
                  >
                    Cliente
                  </label>
                  <select
                    ref={clienteRef}
                    id="agendamento-clienteId"
                    name="clienteId"
                    required
                    value={form.clienteId}
                    onChange={(event) =>
                      atualizarCampo("clienteId", event.target.value)
                    }
                    onBlur={() =>
                      setErros((atuais) => ({
                        ...atuais,
                        clienteId: validarCampo(
                          "clienteId",
                          form.clienteId,
                          servicos,
                          modoCliente,
                        ),
                      }))
                    }
                    aria-invalid={campoInvalido("clienteId")}
                    aria-describedby={
                      erros.clienteId ? "agendamento-clienteId-erro" : undefined
                    }
                    className="campo-select min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                  >
                    <option value="">Selecione um cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                  {erros.clienteId && (
                    <p
                      id="agendamento-clienteId-erro"
                      className="flex items-center gap-2 text-base leading-6 text-red-700"
                    >
                      <AlertCircle aria-hidden="true" size={16} />
                      {erros.clienteId}
                    </p>
                  )}
                  <p className="text-sm leading-6 text-zinc-700">
                    {clientes.length === 0
                      ? "Não há clientes cadastrados. Você pode usar uma anotação rápida."
                      : "Ou escolha anotação rápida para não criar um cadastro."}
                  </p>
                </>
              ) : (
                <>
                  <label
                    htmlFor="agendamento-clienteNome"
                    className="block text-base font-semibold"
                  >
                    Nome ou anotação
                  </label>
                  <input
                    ref={clienteRapidoRef}
                    id="agendamento-clienteNome"
                    name="clienteNome"
                    autoFocus
                    required
                    maxLength={100}
                    value={form.clienteNome}
                    onChange={(event) =>
                      atualizarCampo("clienteNome", event.target.value)
                    }
                    onBlur={() =>
                      setErros((atuais) => ({
                        ...atuais,
                        clienteNome: validarCampo(
                          "clienteNome",
                          form.clienteNome,
                          servicos,
                          modoCliente,
                        ),
                      }))
                    }
                    aria-invalid={campoInvalido("clienteNome")}
                    aria-describedby={
                      erros.clienteNome
                        ? "agendamento-clienteNome-erro"
                        : "agendamento-clienteNome-ajuda"
                    }
                    placeholder="Ex.: veio, pia 2"
                    className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                  />
                  <p
                    id="agendamento-clienteNome-ajuda"
                    className="text-sm leading-6 text-zinc-700"
                  >
                    Salvo no agendamento sem criar cadastro de cliente.
                  </p>
                  {erros.clienteNome && (
                    <p
                      id="agendamento-clienteNome-erro"
                      className="flex items-center gap-2 text-base leading-6 text-red-700"
                    >
                      <AlertCircle aria-hidden="true" size={16} />
                      {erros.clienteNome}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-base font-semibold">
                {ehEdicao ? "Serviço" : "Serviços"}
              </p>
              <div
                id="agendamento-servicoIds"
                role="group"
                aria-invalid={campoInvalido("servicoIds")}
                aria-describedby={
                  erros.servicoIds ? "agendamento-servicoIds-erro" : undefined
                }
                className="space-y-2 rounded-md border border-zinc-300 p-2"
              >
                {servicos.map((servico) => {
                  const marcado = form.servicoIds.includes(servico.id);
                  return (
                    <label
                      key={servico.id}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-base leading-6 ${marcado ? "bg-zinc-100" : ""}`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type={ehEdicao ? "radio" : "checkbox"}
                          name="servicoIds"
                          checked={marcado}
                          onChange={() => alternarServico(servico.id)}
                          className="size-5"
                        />
                        {servico.nome}
                      </span>
                      <span className="text-sm text-zinc-700">
                        {servico.duracaoMin} min ·{" "}
                        {formatarPreco(servico.precoCentavos)}
                      </span>
                    </label>
                  );
                })}
              </div>
              {erros.servicoIds && (
                <p
                  id="agendamento-servicoIds-erro"
                  className="flex items-center gap-2 text-base leading-6 text-red-700"
                >
                  <AlertCircle aria-hidden="true" size={16} />
                  {erros.servicoIds}
                </p>
              )}
              {servicos.length === 0 && (
                <p className="text-sm leading-6 text-zinc-700">
                  Cadastre um serviço ativo antes de criar um agendamento.
                </p>
              )}
              {servicosSelecionados.length > 1 && (
                <p className="text-sm leading-6 text-zinc-700">
                  Total: {duracaoTotal} min ·{" "}
                  {formatarPreco(precoTotal)}
                  {horaFim ? ` · termina às ${horaFim}` : ""}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="agendamento-inicio"
                className="text-base font-semibold"
              >
                Data e hora
              </label>
              <input
                id="agendamento-inicio"
                name="inicio"
                type="datetime-local"
                required
                value={form.inicio}
                onChange={(event) => atualizarCampo("inicio", event.target.value)}
                onBlur={() =>
                  setErros((atuais) => ({
                    ...atuais,
                    inicio: validarCampo(
                      "inicio",
                      form.inicio,
                      servicos,
                      modoCliente,
                    ),
                  }))
                }
                aria-invalid={campoInvalido("inicio")}
                aria-describedby={
                  erros.inicio ? "agendamento-inicio-erro" : undefined
                }
                className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              />
              {erros.inicio && (
                <p
                  id="agendamento-inicio-erro"
                  className="flex items-center gap-2 text-base leading-6 text-red-700"
                >
                  <AlertCircle aria-hidden="true" size={16} />
                  {erros.inicio}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="agendamento-observacao"
                className="text-base font-semibold"
              >
                Observação{" "}
                <span className="font-normal text-zinc-700">(opcional)</span>
              </label>
              <textarea
                id="agendamento-observacao"
                name="observacao"
                rows={3}
                value={form.observacao}
                onChange={(event) =>
                  atualizarCampo("observacao", event.target.value)
                }
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              />
            </div>

            {erroApi && !mostrarConfirmacao && (
              <p
                role="alert"
                className="flex items-center gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={20} />
                {erroApi}
              </p>
            )}

            <div className="mt-auto flex flex-col-reverse gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={fechar}
                className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-base font-semibold hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              >
                {salvando && (
                  <Loader2
                    aria-hidden="true"
                    size={20}
                    className="animate-spin motion-reduce:animate-none"
                  />
                )}
                {salvando
                  ? "Salvando…"
                  : agendamento
                    ? "Salvar alterações"
                    : "Revisar agendamento"}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      {mostrarConfirmacao && (
        <dialog
          open
          aria-labelledby="confirmar-agendamento-titulo"
          className="fixed inset-0 z-[60] m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40"
        >
          <div className="space-y-4">
            <h2
              id="confirmar-agendamento-titulo"
              className="text-lg font-semibold leading-6"
            >
              Confirmar agendamento
            </h2>
            <div className="space-y-1 text-base leading-6 text-zinc-800">
              <p>
                <span className="font-semibold">Cliente:</span>{" "}
                {nomeParaConfirmacao || "—"}
              </p>
              <p className="font-semibold">Serviços:</p>
              <ul className="ml-4 list-disc">
                {servicosSelecionados.map((servico) => (
                  <li key={servico.id}>
                    {servico.nome} · {servico.duracaoMin} min ·{" "}
                    {formatarPreco(servico.precoCentavos)}
                  </li>
                ))}
              </ul>
              <p className="pt-1">
                <span className="font-semibold">Início:</span>{" "}
                {formatarHoraLocal(form.inicio)}
                {horaFim && (
                  <>
                    {" "}
                    <span className="font-semibold">· Término:</span>{" "}
                    {horaFim}
                  </>
                )}
              </p>
              <p>
                <span className="font-semibold">Total:</span>{" "}
                {formatarPreco(precoTotal)} · {duracaoTotal} min
              </p>
            </div>

            {erroApi && (
              <p
                role="alert"
                className="flex items-start gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
                {erroApi}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={salvando}
                onClick={() => setMostrarConfirmacao(false)}
                className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-base font-semibold hover:bg-zinc-50 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void confirmarEnvio()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              >
                {salvando && (
                  <Loader2
                    aria-hidden="true"
                    size={20}
                    className="animate-spin motion-reduce:animate-none"
                  />
                )}
                {salvando ? "Salvando…" : "Confirmar e agendar"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
