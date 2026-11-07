"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch } from "@/lib/auth";
import type { Servico } from "@/lib/types";

const vazio = { nome: "", duracaoMin: "", precoCentavos: "" };

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    authFetch("/servicos")
      .then(setServicos)
      .catch((err) => setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, []);

  function iniciarEdicao(servico: Servico) {
    setEditandoId(servico.id);
    setForm({
      nome: servico.nome,
      duracaoMin: String(servico.duracaoMin),
      precoCentavos: String(servico.precoCentavos / 100),
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
      duracaoMin: Number(form.duracaoMin),
      precoCentavos: Math.round(Number(form.precoCentavos) * 100),
    };
    try {
      if (editandoId) {
        await authFetch(`/servicos/${editandoId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await authFetch("/servicos", {
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
    if (!confirm("Desativar este serviço?")) return;
    try {
      await authFetch(`/servicos/${id}`, { method: "DELETE" });
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Serviços</h1>
        <p className="text-sm text-zinc-500">
          Cadastre os serviços oferecidos pela barbearia.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-md border border-zinc-200 p-4"
      >
        <h2 className="text-sm font-medium">
          {editandoId ? "Editar serviço" : "Novo serviço"}
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
            <label className="text-xs text-zinc-500">Duração (min)</label>
            <input
              required
              type="number"
              min={5}
              value={form.duracaoMin}
              onChange={(e) => setForm({ ...form, duracaoMin: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Preço (R$)</label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={form.precoCentavos}
              onChange={(e) =>
                setForm({ ...form, precoCentavos: e.target.value })
              }
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

      {!carregando && servicos.length === 0 && (
        <p className="text-sm text-zinc-500">Nenhum serviço cadastrado ainda.</p>
      )}

      <ul className="space-y-2">
        {servicos.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{s.nome}</p>
              <p className="text-zinc-500">
                {s.duracaoMin} min · R$ {(s.precoCentavos / 100).toFixed(2)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => iniciarEdicao(s)}
                className="text-xs text-zinc-500 hover:text-zinc-950"
              >
                Editar
              </button>
              <button
                onClick={() => handleRemover(s.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Desativar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
