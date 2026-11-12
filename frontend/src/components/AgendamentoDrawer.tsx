"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import type { Agendamento, Cliente, Servico } from "@/lib/types";

export type AgendamentoFormValues = {
  clienteId: string;
  clienteNome: string;
  servicoId: string;
  inicio: string;
  observacao: string;
};

type Campo = keyof AgendamentoFormValues;
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
  valor: string,
  servicos: Servico[],
  modoCliente: ModoCliente,
) {
  if (campo === "clienteId" && modoCliente === "cadastrado" && !valor) {
    return "Selecione um cliente";
  }
  if (
    campo === "clienteNome" &&
    modoCliente === "rapido" &&
    valor.trim().length < 2
  ) {
    return "Informe uma identificação (mínimo 2 letras)";
  }
  if (
    campo === "servicoId" &&
    !servicos.some((servico) => servico.id === valor)
  ) {
    return "Selecione um serviço ativo";
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
  const [modoCliente, setModoCliente] = useState<ModoCliente>(
    agendamento?.clienteId ? "cadastrado" : "rapido",
  );
  const [form, setForm] = useState<AgendamentoFormValues>({
    clienteId: agendamento?.clienteId ?? "",
    clienteNome:
      agendamento?.clienteNome ?? agendamento?.cliente?.nome ?? "",
    servicoId:
      agendamento &&
      servicos.some((servico) => servico.id === agendamento.servicoId)
        ? agendamento.servicoId
        : "",
    inicio: agendamento
      ? paraDatetimeLocal(agendamento.inicio)
      : inicioInicial(dataInicial),
    observacao: agendamento?.observacao ?? "",
  });
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

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
      "servicoId",
      "inicio",
    ];
    for (const campo of campos) {
      const erro = validarCampo(campo, form[campo], servicos, modoCliente);
      if (erro) novosErros[campo] = erro;
    }
    setErros(novosErros);
    return Object.keys(novosErros)[0] as Campo | undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroApi(null);
    const primeiroErro = validarFormulario();
    if (primeiroErro) {
      document.getElementById(`agendamento-${primeiroErro}`)?.focus();
      return;
    }

    setSalvando(true);
    try {
      await onSave({
        ...form,
        clienteId: modoCliente === "cadastrado" ? form.clienteId : "",
        clienteNome:
          modoCliente === "rapido" ? form.clienteNome.trim() : "",
        observacao: form.observacao.trim(),
      });
    } catch (error) {
      setErroApi(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o agendamento.",
      );
    } finally {
      setSalvando(false);
    }
  }

  function atualizarCampo(campo: Campo, valor: string) {
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

  function campoInvalido(campo: Campo) {
    return Boolean(erros[campo]);
  }

  return (
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
              Escolha o cliente, o serviço e um horário.
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
                  className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
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
            <label
              htmlFor="agendamento-servicoId"
              className="text-base font-semibold"
            >
              Serviço
            </label>
            <select
              id="agendamento-servicoId"
              name="servicoId"
              required
              value={form.servicoId}
              onChange={(event) =>
                atualizarCampo("servicoId", event.target.value)
              }
              onBlur={() =>
                setErros((atuais) => ({
                  ...atuais,
                  servicoId: validarCampo(
                    "servicoId",
                    form.servicoId,
                    servicos,
                    modoCliente,
                  ),
                }))
              }
              aria-invalid={campoInvalido("servicoId")}
              aria-describedby={
                erros.servicoId ? "agendamento-servicoId-erro" : undefined
              }
              className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              <option value="">Selecione um serviço</option>
              {servicos.map((servico) => (
                <option key={servico.id} value={servico.id}>
                  {servico.nome} · {servico.duracaoMin} min ·{" "}
                  {formatarPreco(servico.precoCentavos)}
                </option>
              ))}
            </select>
            {erros.servicoId && (
              <p
                id="agendamento-servicoId-erro"
                className="flex items-center gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={16} />
                {erros.servicoId}
              </p>
            )}
            {servicos.length === 0 && (
              <p className="text-sm leading-6 text-zinc-700">
                Cadastre um serviço ativo antes de criar um agendamento.
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

          {erroApi && (
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
                  : "Agendar cliente"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
