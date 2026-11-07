"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

type Servico = {
  id: string;
  nome: string;
  duracaoMin: number;
  precoCentavos: number;
};

function hojeISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoId, setServicoId] = useState("");
  const [data, setData] = useState(hojeISO());
  const [horarios, setHorarios] = useState<string[]>([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [carregandoServicos, setCarregandoServicos] = useState(true);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    apiFetch(`/publico/${slug}/servicos`)
      .then((lista: Servico[]) => {
        setServicos(lista);
        if (lista.length > 0) setServicoId(lista[0].id);
      })
      .catch(() => setErro("Não consegui carregar os serviços dessa barbearia."))
      .finally(() => setCarregandoServicos(false));
  }, [slug]);

  useEffect(() => {
    if (!servicoId || !data) return;
    setCarregandoHorarios(true);
    setHorarioEscolhido(null);
    apiFetch(
      `/publico/${slug}/horarios?servicoId=${encodeURIComponent(servicoId)}&data=${encodeURIComponent(data)}`,
    )
      .then(setHorarios)
      .catch(() => setHorarios([]))
      .finally(() => setCarregandoHorarios(false));
  }, [slug, servicoId, data]);

  async function handleConfirmar(e: FormEvent) {
    e.preventDefault();
    if (!horarioEscolhido) return;
    setErro(null);
    setEnviando(true);
    try {
      await apiFetch(`/publico/${slug}/agendamento`, {
        method: "POST",
        body: JSON.stringify({
          nome,
          telefone,
          servicoId,
          inicio: horarioEscolhido,
        }),
      });
      setConfirmado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao agendar");
    } finally {
      setEnviando(false);
    }
  }

  if (confirmado) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Agendado!</h1>
          <p className="text-sm text-zinc-500">
            Seu horário foi marcado para{" "}
            {horarioEscolhido &&
              new Date(horarioEscolhido).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            . Até lá!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Agendar horário</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Escolha o serviço, a data e um horário disponível.
      </p>

      {carregandoServicos && <p className="text-sm text-zinc-500">Carregando...</p>}

      {!carregandoServicos && servicos.length === 0 && (
        <p className="text-sm text-zinc-500">
          Essa barbearia ainda não tem serviços disponíveis para agendamento.
        </p>
      )}

      {!carregandoServicos && servicos.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Serviço</label>
            <select
              value={servicoId}
              onChange={(e) => setServicoId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} · {s.duracaoMin} min · R$ {(s.precoCentavos / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Data</label>
            <input
              type="date"
              min={hojeISO()}
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Horários disponíveis</label>
            {carregandoHorarios && (
              <p className="text-sm text-zinc-500">Carregando horários...</p>
            )}
            {!carregandoHorarios && horarios.length === 0 && (
              <p className="text-sm text-zinc-500">
                Nenhum horário livre nesse dia. Tente outra data.
              </p>
            )}
            {!carregandoHorarios && horarios.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {horarios.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorarioEscolhido(h)}
                    className={`rounded-md border px-2 py-1.5 text-sm ${
                      horarioEscolhido === h
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-300 hover:border-zinc-950"
                    }`}
                  >
                    {new Date(h).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>

          {horarioEscolhido && (
            <form onSubmit={handleConfirmar} className="space-y-3 border-t border-zinc-200 pt-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Seu nome</label>
                <input
                  required
                  minLength={2}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Seu telefone</label>
                <input
                  required
                  minLength={8}
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {enviando ? "Confirmando..." : "Confirmar agendamento"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
