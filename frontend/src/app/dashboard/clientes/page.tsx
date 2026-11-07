"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch } from "@/lib/auth";
import type { Cliente } from "@/lib/types";

const vazio = { nome: "", telefone: "", email: "" };

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    authFetch("/clientes")
      .then(setClientes)
      .catch((err) => setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, []);

  function iniciarEdicao(cliente: Cliente) {
    setEditandoId(cliente.id);
    setForm({
      nome: cliente.nome,
      telefone: cliente.telefone ?? "",
      email: cliente.email ?? "",
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(vazio);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const payload = {
      nome: form.nome,
      telefone: form.telefone || undefined,
      email: form.email || undefined,
    };
    try {
      if (editandoId) {
        await authFetch(`/clientes/${editandoId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await authFetch("/clientes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      cancelarEdicao();
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(id: string) {
    if (!confirm("Excluir este cliente?")) return;
    try {
      await authFetch(`/clientes/${id}`, { method: "DELETE" });
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-sm text-zinc-500">Cadastre os clientes da barbearia.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-md border border-zinc-200 p-4"
      >
        <h2 className="text-sm font-medium">
          {editandoId ? "Editar cliente" : "Novo cliente"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Nome</label>
            <input
              required
              minLength={2}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Telefone (opcional)</label>
            <input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">E-mail (opcional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Adicionar"}
          </button>
          {editandoId && (
            <button
              type="button"
              onClick={cancelarEdicao}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {carregando && <p className="text-sm text-zinc-500">Carregando...</p>}

      {!carregando && clientes.length === 0 && (
        <p className="text-sm text-zinc-500">Nenhum cliente cadastrado ainda.</p>
      )}

      <ul className="space-y-2">
        {clientes.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{c.nome}</p>
              <p className="text-zinc-500">
                {c.telefone || "sem telefone"}
                {c.email ? ` · ${c.email}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => iniciarEdicao(c)}
                className="text-xs text-zinc-500 hover:text-zinc-950"
              >
                Editar
              </button>
              <button
                onClick={() => handleRemover(c.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
