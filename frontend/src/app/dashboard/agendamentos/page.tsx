"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch } from "@/lib/auth";
import type { Agendamento, Cliente, Servico, StatusAgendamento } from "@/lib/types";

const vazio = { clienteId: "", servicoId: "", inicio: "", observacao: "" };

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  NAO_COMPARECEU: "Não compareceu",
};

const STATUS_OPCOES = Object.keys(STATUS_LABEL) as StatusAgendamento[];

function paraDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    Promise.all([
      authFetch("/agendamentos"),
      authFetch("/clientes"),
      authFetch("/servicos"),
    ])
      .then(([agendamentosData, clientesData, servicosData]) => {
        setAgendamentos(agendamentosData);
        setClientes(clientesData);
        setServicos(servicosData);
      })
      .catch((err) => setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, []);

  function iniciarEdicao(agendamento: Agendamento) {
    setEditandoId(agendamento.id);
    setForm({
      clienteId: agendamento.clienteId,
      servicoId: agendamento.servicoId,
      inicio: paraDatetimeLocal(agendamento.inicio),
      observacao: agendamento.observacao ?? "",
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
      clienteId: form.clienteId,
      servicoId: form.servicoId,
      inicio: new Date(form.inicio).toISOString(),
      observacao: form.observacao || undefined,
    };
    try {
      if (editandoId) {
        await authFetch(`/agendamentos/${editandoId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await authFetch("/agendamentos", {
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

  async function handleStatus(id: string, status: StatusAgendamento) {
    try {
      await authFetch(`/agendamentos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  }

  async function handleCancelar(id: string) {
    if (!confirm("Cancelar este agendamento?")) return;
    try {
      await authFetch(`/agendamentos/${id}`, { method: "DELETE" });
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao cancelar");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Agendamentos</h1>
        <p className="text-sm text-zinc-500">Marque horários para os clientes.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-md border border-zinc-200 p-4"
      >
        <h2 className="text-sm font-medium">
          {editandoId ? "Editar agendamento" : "Novo agendamento"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Cliente</label>
            <select
              required
              value={form.clienteId}
              onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecione...
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Serviço</label>
            <select
              required
              value={form.servicoId}
              onChange={(e) => setForm({ ...form, servicoId: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecione...
              </option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.duracaoMin} min)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Data e hora</label>
            <input
              required
              type="datetime-local"
              value={form.inicio}
              onChange={(e) => setForm({ ...form, inicio: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Observação (opcional)</label>
            <input
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
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
            {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Agendar"}
          </button>
          {editandoId && (
            <button
              type="button"
              onClick={cancelarEdicao}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {carregando && <p className="text-sm text-zinc-500">Carregando...</p>}

      {!carregando && agendamentos.length === 0 && (
        <p className="text-sm text-zinc-500">Nenhum agendamento ainda.</p>
      )}

      {!carregando && agendamentos.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-8" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[17%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Data</th>
                <th className="px-2 py-2 font-medium">Hora</th>
                <th className="px-2 py-2 font-medium">Cliente</th>
                <th className="px-2 py-2 font-medium">Serviço</th>
                <th className="px-2 py-2 font-medium">Valor</th>
                <th className="px-2 py-2 font-medium">Observação</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {agendamentos.map((a, i) => {
                const inicio = new Date(a.inicio);
                return (
                  <tr
                    key={a.id}
                    className={`border-b border-zinc-100 last:border-0 ${
                      i % 2 === 1 ? "bg-zinc-50" : "bg-white"
                    }`}
                  >
                    <td className="truncate px-2 py-2 text-zinc-400 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="truncate px-2 py-2 tabular-nums">
                      {inicio.toLocaleDateString("pt-BR")}
                    </td>
                    <td className="truncate px-2 py-2 tabular-nums">
                      {inicio.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="truncate px-2 py-2 font-medium" title={a.cliente.nome}>
                      {a.cliente.nome}
                    </td>
                    <td className="truncate px-2 py-2" title={a.servico.nome}>
                      {a.servico.nome}
                    </td>
                    <td className="truncate px-2 py-2 tabular-nums">
                      R$ {(a.servico.precoCentavos / 100).toFixed(2)}
                    </td>
                    <td
                      className="truncate px-2 py-2 text-zinc-500"
                      title={a.observacao ?? undefined}
                    >
                      {a.observacao || "—"}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={a.status}
                        onChange={(e) =>
                          handleStatus(a.id, e.target.value as StatusAgendamento)
                        }
                        className="w-full rounded-md border border-zinc-300 px-1 py-1 text-xs"
                      >
                        {STATUS_OPCOES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="truncate px-2 py-2">
                      <button
                        onClick={() => iniciarEdicao(a)}
                        className="text-xs text-zinc-500 hover:text-zinc-950"
                      >
                        Editar
                      </button>
                      <span className="mx-1.5 text-zinc-300">|</span>
                      <button
                        onClick={() => handleCancelar(a.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50 font-medium">
                <td className="px-2 py-2" colSpan={5}>
                  Total (exceto cancelados)
                </td>
                <td className="px-2 py-2 tabular-nums">
                  R${" "}
                  {(
                    agendamentos
                      .filter((a) => a.status !== "CANCELADO")
                      .reduce((soma, a) => soma + a.servico.precoCentavos, 0) / 100
                  ).toFixed(2)}
                </td>
                <td className="px-2 py-2" colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
