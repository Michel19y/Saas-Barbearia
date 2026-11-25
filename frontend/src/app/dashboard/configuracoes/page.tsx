"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import Toast from "@/components/Toast";
import { authFetch, decodeToken, getToken } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import type { Barbearia } from "@/lib/types";

export default function ConfiguracoesPage() {
  const [ehDono, setEhDono] = useState(false);
  const [barbearia, setBarbearia] = useState<Barbearia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const sugestao = slugify(nome);
  const [telefone, setTelefone] = useState("");
  const [enderecoCidade, setEnderecoCidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const dados = (await authFetch("/barbearia/minha")) as Barbearia;
      setBarbearia(dados);
      setNome(dados.nome);
      setSlug(dados.slug);
      setTelefone(dados.telefone ?? "");
      setEnderecoCidade(dados.enderecoCidade ?? "");
    } catch (error) {
      setErroCarga(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados da barbearia.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    setEhDono(decodeToken(token ?? "")?.papel === "DONO");
    void carregar();
  }, [carregar]);

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErroForm(null);
    setSalvando(true);
    try {
      const atualizada = (await authFetch("/barbearia/minha", {
        method: "PATCH",
        body: JSON.stringify({
          nome: nome.trim(),
          slug: slugify(slug),
          telefone: telefone.trim() || undefined,
          enderecoCidade: enderecoCidade.trim() || undefined,
        }),
      })) as Barbearia;
      const linkMudou = atualizada.slug !== barbearia?.slug;
      setBarbearia(atualizada);
      setSlug(atualizada.slug);
      setToast(
        linkMudou
          ? `Link atualizado: /agendar/${atualizada.slug}`
          : "Dados da barbearia atualizados",
      );
    } catch (error) {
      setErroForm(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as alterações.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const campoClasse =
    "min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";

  return (
    <div className="max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold leading-8">Configurações</h1>
        <p className="mt-1 text-base leading-6 text-zinc-700">
          Dados gerais da sua barbearia.
        </p>
      </header>

      {carregando && (
        <div
          aria-busy="true"
          className="h-40 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 motion-reduce:animate-none"
        />
      )}

      {!carregando && erroCarga && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-base leading-6 text-red-800"
        >
          <AlertCircle aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <span>{erroCarga}</span>
        </div>
      )}

      {!carregando && !erroCarga && barbearia && (
        <form onSubmit={salvar} className="space-y-6 rounded-lg border border-zinc-200 p-4">
          {!ehDono && (
            <p className="text-sm leading-6 text-zinc-700">
              Apenas o dono pode editar esses dados. Você pode visualizá-los.
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor="config-nome" className="text-base font-semibold">
              Nome da barbearia
            </label>
            <input
              id="config-nome"
              required
              minLength={2}
              disabled={!ehDono}
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className={`${campoClasse} disabled:bg-zinc-100 disabled:text-zinc-600`}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="config-telefone" className="text-base font-semibold">
              Telefone{" "}
              <span className="font-normal text-zinc-700">(opcional)</span>
            </label>
            <input
              id="config-telefone"
              disabled={!ehDono}
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
              className={`${campoClasse} disabled:bg-zinc-100 disabled:text-zinc-600`}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="config-cidade" className="text-base font-semibold">
              Cidade{" "}
              <span className="font-normal text-zinc-700">(opcional)</span>
            </label>
            <input
              id="config-cidade"
              disabled={!ehDono}
              value={enderecoCidade}
              onChange={(event) => setEnderecoCidade(event.target.value)}
              className={`${campoClasse} disabled:bg-zinc-100 disabled:text-zinc-600`}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="config-slug" className="text-base font-semibold">
              Link de agendamento
            </label>
            <div className="flex items-stretch">
              <span className="flex items-center rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 px-3 text-base text-zinc-600">
                /agendar/
              </span>
              <input
                id="config-slug"
                required
                minLength={3}
                maxLength={60}
                disabled={!ehDono}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                onBlur={() => setSlug(slugify(slug))}
                aria-describedby="config-slug-ajuda"
                className={`${campoClasse} min-w-0 rounded-l-none disabled:bg-zinc-100 disabled:text-zinc-600`}
              />
            </div>
            {ehDono && sugestao !== slugify(slug) && (
              <button
                type="button"
                onClick={() => setSlug(sugestao)}
                className="min-h-11 text-left text-base font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700"
              >
                Usar o nome: /agendar/{sugestao}
              </button>
            )}
            <p id="config-slug-ajuda" className="text-sm leading-6 text-zinc-700">
              {slugify(slug) !== barbearia.slug
                ? `Quem abrir o link antigo (/agendar/${barbearia.slug}) vai cair no novo automaticamente.`
                : "Só letras, números e hífen. Se mudar, o link antigo continua funcionando."}
            </p>
          </div>

          {erroForm && (
            <p role="alert" className="flex items-center gap-2 text-base leading-6 text-red-700">
              <AlertCircle aria-hidden="true" size={20} />
              {erroForm}
            </p>
          )}

          {ehDono && (
            <button
              type="submit"
              disabled={salvando}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-base font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              {salvando && (
                <Loader2 aria-hidden="true" size={20} className="animate-spin motion-reduce:animate-none" />
              )}
              {salvando ? "Salvando…" : "Salvar alterações"}
            </button>
          )}
        </form>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
