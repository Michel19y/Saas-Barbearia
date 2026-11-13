"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import type { Servico } from "@/lib/types";

export type ServicoFormValues = {
  nome: string;
  duracaoMin: number;
  precoCentavos: number;
};

type Campo = "nome" | "duracaoMin" | "preco";
type ErrosCampos = Partial<Record<Campo, string>>;

type ServicoDrawerProps = {
  servico: Servico | null;
  onClose: () => void;
  onSave: (values: ServicoFormValues) => Promise<void>;
};

function precoParaTexto(precoCentavos: number) {
  return (precoCentavos / 100).toFixed(2).replace(".", ",");
}

function textoParaCentavos(valor: string) {
  const numero = Number(valor.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? Math.round(numero * 100) : Number.NaN;
}

function validarCampo(campo: Campo, valor: string) {
  if (campo === "nome" && valor.trim().length < 2) {
    return "Informe o nome do serviço (mínimo 2 letras)";
  }
  if (campo === "duracaoMin") {
    const minutos = Number(valor);
    if (!valor.trim() || !Number.isInteger(minutos)) {
      return "Informe a duração em minutos";
    }
    if (minutos < 5) return "A duração mínima é de 5 minutos";
  }
  if (campo === "preco") {
    const centavos = textoParaCentavos(valor);
    if (!valor.trim() || Number.isNaN(centavos)) return "Informe o preço";
    if (centavos < 0) return "O preço não pode ser negativo";
  }
  return undefined;
}

export default function ServicoDrawer({
  servico,
  onClose,
  onSave,
}: ServicoDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    nome: servico?.nome ?? "",
    duracaoMin: servico ? String(servico.duracaoMin) : "30",
    preco: servico ? precoParaTexto(servico.precoCentavos) : "",
  });
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const frame = window.requestAnimationFrame(() => nomeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
    };
  }, []);

  function fechar() {
    dialogRef.current?.close();
    onClose();
  }

  function atualizarCampo(campo: Campo, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      return { ...atuais, [campo]: validarCampo(campo, valor) };
    });
  }

  function validarFormulario() {
    const novosErros: ErrosCampos = {};
    for (const campo of ["nome", "duracaoMin", "preco"] as const) {
      const erro = validarCampo(campo, form[campo]);
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
      document.getElementById(`servico-${primeiroErro}`)?.focus();
      return;
    }

    setSalvando(true);
    try {
      await onSave({
        nome: form.nome.trim(),
        duracaoMin: Number(form.duracaoMin),
        precoCentavos: textoParaCentavos(form.preco),
      });
    } catch (error) {
      setErroApi(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o serviço.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const campoClasse =
    "min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="servico-drawer-titulo"
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
            <h2
              id="servico-drawer-titulo"
              className="text-2xl font-semibold leading-8"
            >
              {servico ? "Editar serviço" : "Novo serviço"}
            </h2>
            <p className="mt-1 text-base leading-6 text-zinc-700">
              A duração define o tempo reservado na agenda.
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
          <div className="space-y-2">
            <label htmlFor="servico-nome" className="text-base font-semibold">
              Nome
            </label>
            <input
              ref={nomeRef}
              id="servico-nome"
              name="nome"
              type="text"
              autoFocus
              required
              minLength={2}
              placeholder="Ex.: Corte masculino"
              value={form.nome}
              onChange={(event) => atualizarCampo("nome", event.target.value)}
              onBlur={() =>
                setErros((atuais) => ({
                  ...atuais,
                  nome: validarCampo("nome", form.nome),
                }))
              }
              aria-invalid={Boolean(erros.nome)}
              aria-describedby={erros.nome ? "servico-nome-erro" : undefined}
              className={campoClasse}
            />
            {erros.nome && (
              <p
                id="servico-nome-erro"
                className="flex items-center gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={16} />
                {erros.nome}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="servico-duracaoMin"
              className="text-base font-semibold"
            >
              Duração{" "}
              <span className="font-normal text-zinc-700">(minutos)</span>
            </label>
            <input
              id="servico-duracaoMin"
              name="duracaoMin"
              type="number"
              inputMode="numeric"
              min={5}
              step={5}
              required
              value={form.duracaoMin}
              onChange={(event) =>
                atualizarCampo("duracaoMin", event.target.value)
              }
              onBlur={() =>
                setErros((atuais) => ({
                  ...atuais,
                  duracaoMin: validarCampo("duracaoMin", form.duracaoMin),
                }))
              }
              aria-invalid={Boolean(erros.duracaoMin)}
              aria-describedby={
                erros.duracaoMin ? "servico-duracaoMin-erro" : undefined
              }
              className={`${campoClasse} tabular-nums`}
            />
            {erros.duracaoMin && (
              <p
                id="servico-duracaoMin-erro"
                className="flex items-center gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={16} />
                {erros.duracaoMin}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="servico-preco" className="text-base font-semibold">
              Preço <span className="font-normal text-zinc-700">(R$)</span>
            </label>
            <input
              id="servico-preco"
              name="preco"
              type="text"
              inputMode="decimal"
              required
              placeholder="0,00"
              value={form.preco}
              onChange={(event) => atualizarCampo("preco", event.target.value)}
              onBlur={() =>
                setErros((atuais) => ({
                  ...atuais,
                  preco: validarCampo("preco", form.preco),
                }))
              }
              aria-invalid={Boolean(erros.preco)}
              aria-describedby={erros.preco ? "servico-preco-erro" : undefined}
              className={`${campoClasse} tabular-nums`}
            />
            {erros.preco && (
              <p
                id="servico-preco-erro"
                className="flex items-center gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={16} />
                {erros.preco}
              </p>
            )}
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
                : servico
                  ? "Salvar alterações"
                  : "Cadastrar serviço"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
