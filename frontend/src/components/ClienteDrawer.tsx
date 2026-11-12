"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import type { Cliente } from "@/lib/types";

export type ClienteFormValues = {
  nome: string;
  telefone: string;
  email: string;
};

type Campo = keyof ClienteFormValues;
type ErrosCampos = Partial<Record<Campo, string>>;

type ClienteDrawerProps = {
  cliente: Cliente | null;
  nomeInicial: string;
  onClose: () => void;
  onSave: (values: ClienteFormValues) => Promise<void>;
};

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarTelefoneParcial(valor: string) {
  const digitos = somenteDigitos(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos ? `(${digitos}` : "";

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  if (digitos.length <= 6) return `(${ddd}) ${numero}`;

  const tamanhoPrefixo = digitos.length === 11 ? 5 : 4;
  return `(${ddd}) ${numero.slice(0, tamanhoPrefixo)}-${numero.slice(tamanhoPrefixo)}`;
}

function validarCampo(campo: Campo, valor: string) {
  if (campo === "nome" && valor.trim().length < 2) {
    return "Informe o nome (mínimo 2 letras)";
  }
  if (
    campo === "telefone" &&
    valor.trim() &&
    ![10, 11].includes(somenteDigitos(valor).length)
  ) {
    return "Informe um telefone com DDD";
  }
  if (
    campo === "email" &&
    valor.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
  ) {
    return "Informe um e-mail válido";
  }
  return undefined;
}

export default function ClienteDrawer({
  cliente,
  nomeInicial,
  onClose,
  onSave,
}: ClienteDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ClienteFormValues>({
    nome: cliente?.nome ?? nomeInicial,
    telefone: cliente?.telefone
      ? formatarTelefoneParcial(cliente.telefone)
      : "",
    email: cliente?.email ?? "",
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
    const novoValor =
      campo === "telefone" ? formatarTelefoneParcial(valor) : valor;
    setForm((atual) => ({ ...atual, [campo]: novoValor }));
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const erro = validarCampo(campo, novoValor);
      return { ...atuais, [campo]: erro };
    });
  }

  function validarFormulario() {
    const novosErros: ErrosCampos = {};
    for (const campo of ["nome", "telefone", "email"] as const) {
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
      document.getElementById(`cliente-${primeiroErro}`)?.focus();
      return;
    }

    setSalvando(true);
    try {
      await onSave({
        nome: form.nome.trim(),
        telefone: somenteDigitos(form.telefone),
        email: form.email.trim(),
      });
    } catch (error) {
      setErroApi(
        error instanceof Error ? error.message : "Não foi possível salvar o cliente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  function campoInvalido(campo: Campo) {
    return Boolean(erros[campo]);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cliente-drawer-titulo"
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
              id="cliente-drawer-titulo"
              className="text-2xl font-semibold leading-8"
            >
              {cliente ? "Editar cliente" : "Novo cliente"}
            </h2>
            <p className="mt-1 text-base leading-6 text-zinc-700">
              Preencha os dados de contato do cliente.
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
            <label htmlFor="cliente-nome" className="text-base font-semibold">
              Nome
            </label>
            <input
              ref={nomeRef}
              id="cliente-nome"
              name="nome"
              type="text"
              autoComplete="name"
              autoFocus
              required
              minLength={2}
              value={form.nome}
              onChange={(event) => atualizarCampo("nome", event.target.value)}
              onBlur={() =>
                setErros((atuais) => ({
                  ...atuais,
                  nome: validarCampo("nome", form.nome),
                }))
              }
              aria-invalid={campoInvalido("nome")}
              aria-describedby={erros.nome ? "cliente-nome-erro" : undefined}
              className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            />
            {erros.nome && (
              <p
                id="cliente-nome-erro"
                className="flex items-center gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={16} />
                {erros.nome}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="cliente-telefone" className="text-base font-semibold">
              Telefone <span className="font-normal text-zinc-700">(opcional)</span>
            </label>
            <input
              id="cliente-telefone"
              name="telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.telefone}
              onChange={(event) =>
                atualizarCampo("telefone", event.target.value)
              }
              onBlur={() =>
                setErros((atuais) => ({
                  ...atuais,
                  telefone: validarCampo("telefone", form.telefone),
                }))
              }
              aria-invalid={campoInvalido("telefone")}
              aria-describedby={
                erros.telefone ? "cliente-telefone-erro" : undefined
              }
              className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            />
            {erros.telefone && (
              <p
                id="cliente-telefone-erro"
                className="flex items-center gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={16} />
                {erros.telefone}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="cliente-email" className="text-base font-semibold">
              E-mail <span className="font-normal text-zinc-700">(opcional)</span>
            </label>
            <input
              id="cliente-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => atualizarCampo("email", event.target.value)}
              onBlur={() =>
                setErros((atuais) => ({
                  ...atuais,
                  email: validarCampo("email", form.email),
                }))
              }
              aria-invalid={campoInvalido("email")}
              aria-describedby={erros.email ? "cliente-email-erro" : undefined}
              className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            />
            {erros.email && (
              <p
                id="cliente-email-erro"
                className="flex items-center gap-2 text-base leading-6 text-red-700"
              >
                <AlertCircle aria-hidden="true" size={16} />
                {erros.email}
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
                : cliente
                  ? "Salvar alterações"
                  : "Cadastrar cliente"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
