"use client";

import { use, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

type Servico = {
  id: string;
  nome: string;
  duracaoMin: number;
  precoCentavos: number;
};

function paraISO(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hojeISO() {
  return paraISO(new Date());
}

function proximosDias(quantidade: number) {
  const dias: { iso: string; diaSemana: string; dia: number; rotulo?: string }[] = [];
  const hoje = new Date();
  for (let i = 0; i < quantidade; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    dias.push({
      iso: paraISO(d),
      diaSemana: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      dia: d.getDate(),
      rotulo: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : undefined,
    });
  }
  return dias;
}

export default function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const dias = useMemo(() => proximosDias(14), []);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoIds, setServicoIds] = useState<string[]>([]);
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
        if (lista.length > 0) setServicoIds([lista[0].id]);
      })
      .catch(() => setErro("Não consegui carregar os serviços dessa barbearia."))
      .finally(() => setCarregandoServicos(false));
  }, [slug]);

  useEffect(() => {
    if (servicoIds.length === 0 || !data) {
      setHorarios([]);
      return;
    }
    setCarregandoHorarios(true);
    setHorarioEscolhido(null);
    apiFetch(
      `/publico/${slug}/horarios?servicoIds=${encodeURIComponent(servicoIds.join(","))}&data=${encodeURIComponent(data)}`,
    )
      .then(setHorarios)
      .catch(() => setHorarios([]))
      .finally(() => setCarregandoHorarios(false));
  }, [slug, servicoIds, data]);

  function alternarServico(id: string) {
    setServicoIds((atual) =>
      atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id],
    );
  }

  const servicosSelecionados = servicos.filter((s) => servicoIds.includes(s.id));
  const duracaoTotal = servicosSelecionados.reduce((soma, s) => soma + s.duracaoMin, 0);
  const precoTotal = servicosSelecionados.reduce((soma, s) => soma + s.precoCentavos, 0);

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
          servicoIds,
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
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold">Agendar horário</h1>
      <p className="mb-8 text-base text-zinc-500">
        Escolha o serviço, o dia e um horário disponível.
      </p>

      {carregandoServicos && <p className="text-sm text-zinc-500">Carregando...</p>}

      {!carregandoServicos && servicos.length === 0 && (
        <p className="text-sm text-zinc-500">
          Essa barbearia ainda não tem serviços disponíveis para agendamento.
        </p>
      )}

      {!carregandoServicos && servicos.length > 0 && (
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-sm text-zinc-500">
              Serviços (pode escolher mais de um — ex: corte + barba + sobrancelha)
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {servicos.map((s) => {
                const selecionado = servicoIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => alternarServico(s.id)}
                    className={`flex items-start gap-3 rounded-lg border-2 px-5 py-4 text-left transition-colors ${
                      selecionado
                        ? "border-green-600 bg-green-50 text-green-900"
                        : "border-zinc-300 hover:border-zinc-950"
                    }`}
                  >
                    <span
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs ${
                        selecionado
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-zinc-300"
                      }`}
                    >
                      {selecionado && "✓"}
                    </span>
                    <span>
                      <p className="text-lg font-semibold">{s.nome}</p>
                      <p className={selecionado ? "text-green-700" : "text-zinc-500"}>
                        {s.duracaoMin} min · R$ {(s.precoCentavos / 100).toFixed(2)}
                      </p>
                    </span>
                  </button>
                );
              })}
            </div>
            {servicosSelecionados.length > 1 && (
              <p className="text-sm font-medium text-zinc-700">
                Total: {duracaoTotal} min · R$ {(precoTotal / 100).toFixed(2)}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm text-zinc-500">Dia</label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {dias.map((d) => {
                const selecionado = data === d.iso;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setData(d.iso)}
                    className={`flex w-20 shrink-0 flex-col items-center rounded-lg border-2 py-3 transition-colors ${
                      selecionado
                        ? "border-green-600 bg-green-50 text-green-900"
                        : "border-zinc-300 hover:border-zinc-950"
                    }`}
                  >
                    <span className="text-xs uppercase">{d.rotulo ?? d.diaSemana}</span>
                    <span className="text-2xl font-semibold">{d.dia}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-zinc-500">Horários disponíveis</label>
            {servicosSelecionados.length === 0 && (
              <p className="text-sm text-zinc-500">Escolha pelo menos um serviço.</p>
            )}
            {servicosSelecionados.length > 0 && carregandoHorarios && (
              <p className="text-sm text-zinc-500">Carregando horários...</p>
            )}
            {servicosSelecionados.length > 0 && !carregandoHorarios && horarios.length === 0 && (
              <p className="text-sm text-zinc-500">
                Nenhum horário livre nesse dia. Escolha outro dia.
              </p>
            )}
            {!carregandoHorarios && horarios.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {horarios.map((h) => {
                  const selecionado = horarioEscolhido === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorarioEscolhido(h)}
                      className={`rounded-lg border-2 py-3 text-base font-medium transition-colors ${
                        selecionado
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-zinc-300 hover:border-zinc-950"
                      }`}
                    >
                      {new Date(h).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </button>
                  );
                })}
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
