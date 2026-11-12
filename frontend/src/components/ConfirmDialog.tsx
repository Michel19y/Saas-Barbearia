"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel?: string;
  confirmIcon?: ReactNode;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  getErrorMessage?: (error: unknown) => string;
};

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  loadingLabel = "Processando…",
  confirmIcon,
  onCancel,
  onConfirm,
  getErrorMessage,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function fechar() {
    dialogRef.current?.close();
    onCancel();
  }

  async function confirmar() {
    setErro(null);
    setExcluindo(true);
    try {
      await onConfirm();
    } catch (error) {
      setErro(
        getErrorMessage?.(error) ??
          (error instanceof Error
            ? error.message
            : "Não foi possível concluir esta ação."),
      );
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirmacao-titulo"
      aria-describedby="confirmacao-descricao"
      onCancel={(event) => {
        event.preventDefault();
        fechar();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !excluindo) fechar();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40"
    >
      <div className="space-y-4">
        <div>
          <h2
            id="confirmacao-titulo"
            className="text-lg font-semibold leading-6"
          >
            {title}
          </h2>
          <p
            id="confirmacao-descricao"
            className="mt-2 text-base leading-6 text-zinc-700"
          >
            {description}
          </p>
        </div>

        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 text-base leading-6 text-red-700"
          >
            <AlertCircle aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
            {erro}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={excluindo}
            onClick={fechar}
            className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-base font-semibold hover:bg-zinc-50 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={excluindo}
            onClick={() => void confirmar()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 text-base font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            {excluindo ? (
              <Loader2
                aria-hidden="true"
                size={20}
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              confirmIcon ?? <Trash2 aria-hidden="true" size={20} />
            )}
            {excluindo ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
