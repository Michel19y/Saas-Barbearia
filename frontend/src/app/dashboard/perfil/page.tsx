"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import Toast from "@/components/Toast";
import { authFetch, saveToken } from "@/lib/auth";

const PAPEL_LABEL: Record<string, string> = {
  DONO: "Dono",
  PROFISSIONAL: "Profissional",
  RECEPCAO: "Recepção",
};

type Perfil = {
  id: string;
  nome: string;
  email: string;
  papel: string;
};

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const dados = (await authFetch("/auth/me")) as Perfil;
      setPerfil(dados);
      setNome(dados.nome);
    } catch (error) {
      setErroCarga(
        error instanceof Error ? error.message : "Não foi possível carregar seu perfil.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErroForm(null);
    setSalvando(true);
    try {
      const payload: Record<string, string> = {};
      if (perfil && nome.trim() && nome.trim() !== perfil.nome) {
        payload.nome = nome.trim();
      }
      if (novaSenha) {
        payload.senhaAtual = senhaAtual;
        payload.novaSenha = novaSenha;
      }
      if (Object.keys(payload).length === 0) {
        setToast("Nada para salvar");
        setSalvando(false);
        return;
      }
      const resposta = (await authFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      })) as { usuario: Perfil; accessToken: string };
      saveToken(resposta.accessToken);
      setPerfil(resposta.usuario);
      setNome(resposta.usuario.nome);
      setSenhaAtual("");
      setNovaSenha("");
      setToast("Perfil atualizado");
    } catch (error) {
      setErroForm(
        error instanceof Error ? error.message : "Não foi possível salvar as alterações.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const campoClasse =
    "min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2";

  return (
    <div className="max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold leading-8">Meu perfil</h1>
        <p className="mt-1 text-base leading-6 text-zinc-700">
          Seus dados de acesso nesta barbearia.
        </p>
      </header>

      {carregando ? (
        <div
          aria-busy="true"
          className="h-40 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 motion-reduce:animate-none"
        />
      ) : erroCarga ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-base leading-6 text-red-800"
        >
          <AlertCircle aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <span>{erroCarga}</span>
        </div>
      ) : perfil ? (
        <form onSubmit={salvar} className="space-y-6 rounded-lg border border-zinc-200 p-4">
          <div className="space-y-2">
            <label htmlFor="perfil-email" className="text-base font-semibold">
              E-mail
            </label>
            <input
              id="perfil-email"
              value={perfil.email}
              disabled
              className={`${campoClasse} bg-zinc-100 text-zinc-600`}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="perfil-papel" className="text-base font-semibold">
              Papel
            </label>
            <input
              id="perfil-papel"
              value={PAPEL_LABEL[perfil.papel] ?? perfil.papel}
              disabled
              className={`${campoClasse} bg-zinc-100 text-zinc-600`}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="perfil-nome" className="text-base font-semibold">
              Nome
            </label>
            <input
              id="perfil-nome"
              required
              minLength={2}
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className={campoClasse}
            />
          </div>

          <div className="space-y-4 border-t border-zinc-200 pt-4">
            <p className="text-base font-semibold">Alterar senha (opcional)</p>
            <div className="space-y-2">
              <label htmlFor="perfil-senha-atual" className="text-base font-semibold">
                Senha atual
              </label>
              <input
                id="perfil-senha-atual"
                type="password"
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(event) => setSenhaAtual(event.target.value)}
                className={campoClasse}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="perfil-nova-senha" className="text-base font-semibold">
                Nova senha
              </label>
              <input
                id="perfil-nova-senha"
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={novaSenha}
                onChange={(event) => setNovaSenha(event.target.value)}
                className={campoClasse}
              />
            </div>
          </div>

          {erroForm && (
            <p role="alert" className="flex items-center gap-2 text-base leading-6 text-red-700">
              <AlertCircle aria-hidden="true" size={20} />
              {erroForm}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            {salvando && (
              <Loader2 aria-hidden="true" size={20} className="animate-spin motion-reduce:animate-none" />
            )}
            {salvando ? "Salvando…" : "Salvar alterações"}
          </button>
        </form>
      ) : null}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
