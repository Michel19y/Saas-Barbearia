"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Plus, Users } from "lucide-react";
import Toast from "@/components/Toast";
import { authFetch } from "@/lib/auth";
import type { Profissional } from "@/lib/types";

const PAPEL_LABEL: Record<string, string> = {
  DONO: "Dono",
  PROFISSIONAL: "Profissional",
  RECEPCAO: "Recepção",
};

const vazio = { nome: "", email: "", senha: "" };

export default function EquipePage() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const lista = (await authFetch("/profissionais")) as Profissional[];
      setProfissionais(lista);
    } catch (error) {
      setErroCarga(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a equipe.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    queueMicrotask(() => {
      if (ativo) void carregar();
    });
    return () => {
      ativo = false;
    };
  }, [carregar]);

  const dispensarToast = useCallback(() => setToast(null), []);

  async function adicionar(event: FormEvent) {
    event.preventDefault();
    setErroForm(null);
    setSalvando(true);
    try {
      const criado = (await authFetch("/profissionais", {
        method: "POST",
        body: JSON.stringify(form),
      })) as Profissional;
      setProfissionais((atuais) => [...atuais, criado]);
      setForm(vazio);
      setToast(`${criado.nome} entrou na equipe`);
    } catch (error) {
      setErroForm(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o profissional.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const campoClasse =
    "min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2";

  const contagem =
    profissionais.length === 1
      ? "1 pessoa na equipe"
      : `${profissionais.length} pessoas na equipe`;

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <h1 className="text-2xl font-semibold leading-8">Equipe</h1>
        <p className="mt-1 text-base leading-6 text-zinc-700">
          {carregando ? "Carregando…" : contagem} · quem aparece para o cliente
          escolher na página de agendamento.
        </p>
      </header>

      <section
        aria-label="Adicionar profissional"
        className="space-y-4 rounded-lg border border-zinc-200 p-4"
      >
        <h2 className="text-base font-semibold leading-6">
          Adicionar profissional
        </h2>
        <form onSubmit={adicionar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="equipe-nome" className="text-base font-semibold">
                Nome
              </label>
              <input
                id="equipe-nome"
                required
                minLength={2}
                placeholder="Ex.: Carlos"
                value={form.nome}
                onChange={(event) =>
                  setForm({ ...form, nome: event.target.value })
                }
                className={campoClasse}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="equipe-email" className="text-base font-semibold">
                E-mail
              </label>
              <input
                id="equipe-email"
                type="email"
                required
                autoComplete="off"
                placeholder="carlos@barbearia.com"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                className={campoClasse}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="equipe-senha" className="text-base font-semibold">
                Senha de acesso
              </label>
              <input
                id="equipe-senha"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={form.senha}
                onChange={(event) =>
                  setForm({ ...form, senha: event.target.value })
                }
                className={campoClasse}
              />
            </div>
          </div>

          {erroForm && (
            <p
              role="alert"
              className="flex items-center gap-2 text-base leading-6 text-red-700"
            >
              <AlertCircle aria-hidden="true" size={20} />
              {erroForm}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            {salvando ? (
              <Loader2
                aria-hidden="true"
                size={20}
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Plus aria-hidden="true" size={20} />
            )}
            {salvando ? "Adicionando…" : "Adicionar"}
          </button>
        </form>
      </section>

      <section aria-label="Equipe" className="space-y-4">
        {carregando ? (
          <div aria-busy="true" className="space-y-3">
            {Array.from({ length: 2 }, (_, indice) => (
              <div
                key={indice}
                className="h-16 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : erroCarga ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-base leading-6 text-red-800"
          >
            <AlertCircle
              aria-hidden="true"
              size={20}
              className="mt-0.5 shrink-0"
            />
            <span>{erroCarga}</span>
            <button
              type="button"
              onClick={() => void carregar()}
              className="ml-auto min-h-11 shrink-0 rounded-md border border-red-300 px-3 py-2 text-base font-semibold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              Tentar de novo
            </button>
          </div>
        ) : profissionais.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 p-8 text-center">
            <Users
              aria-hidden="true"
              size={32}
              className="mx-auto text-zinc-500"
            />
            <p className="mt-3 text-base font-semibold leading-6">
              Ninguém cadastrado ainda
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {profissionais.map((profissional) => (
              <li
                key={profissional.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-6">
                    {profissional.nome}
                  </p>
                  <p className="truncate text-base leading-6 text-zinc-700">
                    {profissional.email}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1 text-base leading-6 text-zinc-700">
                  {PAPEL_LABEL[profissional.papel] ?? profissional.papel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && <Toast message={toast} onDismiss={dispensarToast} />}
    </div>
  );
}
