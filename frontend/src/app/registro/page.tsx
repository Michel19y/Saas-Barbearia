"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function RegistroPage() {
  const router = useRouter();
  const [nomeBarbearia, setNomeBarbearia] = useState("");
  const [nomeDono, setNomeDono] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ nomeBarbearia, nomeDono, email, senha }),
      });
      saveToken(data.accessToken);
      router.push("/dashboard");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Cadastrar barbearia</h1>
          <p className="text-sm text-zinc-500">
            Crie sua conta e comece a usar o sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="nomeBarbearia" className="text-sm font-medium">
              Nome da barbearia
            </label>
            <input
              id="nomeBarbearia"
              type="text"
              required
              minLength={2}
              value={nomeBarbearia}
              onChange={(e) => setNomeBarbearia(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="nomeDono" className="text-sm font-medium">
              Seu nome
            </label>
            <input
              id="nomeDono"
              type="text"
              required
              minLength={2}
              value={nomeDono}
              onChange={(e) => setNomeDono(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="senha" className="text-sm font-medium">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {carregando ? "Cadastrando..." : "Criar conta"}
          </button>
        </form>

        <p className="text-sm text-zinc-500">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-950"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
