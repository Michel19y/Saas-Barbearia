"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import type { Agendamento } from "@/lib/types";

const OPCOES_PAGAMENTO = [
  "Pix",
  "Dinheiro",
  "Cartão de débito",
  "Cartão de crédito",
  "Outro",
] as const;

function ehFormaPagamento(
  valor: string,
): valor is PagamentoSelecionado["formaPagamento"] {
  return OPCOES_PAGAMENTO.some((opcao) => opcao === valor);
}

export type PagamentoSelecionado = {
  formaPagamento: (typeof OPCOES_PAGAMENTO)[number];
  outroFormaPagamento?: string;
};

type FormaPagamentoDialogProps = {
  agendamento: Agendamento;
  onCancel: () => void;
  onConfirm: (pagamento: PagamentoSelecionado) => Promise<void>;
};

export default function FormaPagamentoDialog({
  agendamento,
  onCancel,
  onConfirm,
}: FormaPagamentoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formaRef = useRef<HTMLSelectElement>(null);
  const [formaPagamento, setFormaPagamento] =
    useState<PagamentoSelecionado["formaPagamento"] | "">("");
  const [outroFormaPagamento, setOutroFormaPagamento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    formaRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function fechar() {
    if (salvando) return;
    dialogRef.current?.close();
    onCancel();
  }

  async function confirmar() {
    if (!formaPagamento) {
      setErro("Selecione uma forma de pagamento.");
      formaRef.current?.focus();
      return;
    }

    const descricao = outroFormaPagamento.trim();
    if (formaPagamento === "Outro" && !descricao) {
      setErro("Informe qual foi a forma de pagamento.");
      document.getElementById("outro-forma-pagamento")?.focus();
      return;
    }

    setErro(null);
    setSalvando(true);
    try {
      await onConfirm({
        formaPagamento,
        ...(formaPagamento === "Outro"
          ? { outroFormaPagamento: descricao }
          : {}),
      });
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o atendimento.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="forma-pagamento-titulo"
      aria-describedby="forma-pagamento-descricao"
      onCancel={(event) => {
        event.preventDefault();
        fechar();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) fechar();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md rounded-lg border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40"
    >
      <div className="space-y-5 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="forma-pagamento-titulo"
              className="text-xl font-semibold leading-7"
            >
              Concluir atendimento
            </h2>
            <p
              id="forma-pagamento-descricao"
              className="mt-2 text-base leading-6 text-zinc-700"
            >
              {agendamento.cliente?.nome ?? agendamento.clienteNome} ·{" "}
              {agendamento.servico.nome}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={salvando}
            aria-label="Fechar seleção de pagamento"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="space-y-2">
          <label
            htmlFor="forma-pagamento"
            className="text-base font-semibold"
          >
            Forma de pagamento
          </label>
          <select
            ref={formaRef}
            id="forma-pagamento"
            value={formaPagamento}
            onChange={(event) => {
              const value = event.target.value;
              if (ehFormaPagamento(value)) {
                setFormaPagamento(value);
                setErro(null);
              } else {
                setFormaPagamento("");
              }
            }}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? "forma-pagamento-erro" : undefined}
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            <option value="">Selecione uma forma de pagamento</option>
            {OPCOES_PAGAMENTO.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </div>

        {formaPagamento === "Outro" && (
          <div className="space-y-2">
            <label
              htmlFor="outro-forma-pagamento"
              className="text-base font-semibold"
            >
              Qual forma de pagamento?
            </label>
            <input
              id="outro-forma-pagamento"
              type="text"
              maxLength={80}
              autoComplete="off"
              value={outroFormaPagamento}
              onChange={(event) => {
                setOutroFormaPagamento(event.target.value);
                setErro(null);
              }}
              aria-invalid={Boolean(erro)}
              aria-describedby={erro ? "forma-pagamento-erro" : undefined}
              className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            />
          </div>
        )}

        {erro && (
          <p
            id="forma-pagamento-erro"
            role="alert"
            className="flex items-start gap-2 text-base leading-6 text-red-700"
          >
            <AlertCircle
              aria-hidden="true"
              size={20}
              className="mt-0.5 shrink-0"
            />
            {erro}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={fechar}
            disabled={salvando}
            className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-base font-semibold hover:bg-zinc-50 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
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
            {salvando ? "Salvando…" : "Concluir atendimento"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
