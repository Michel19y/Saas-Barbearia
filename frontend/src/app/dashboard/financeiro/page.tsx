"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Wallet } from "lucide-react";
import { authFetch } from "@/lib/auth";
import { formatarPreco } from "@/lib/formato";
import type { ResumoFinanceiro } from "@/lib/types";

type Periodo = "hoje" | "semana" | "mes" | "tudo";

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "semana", rotulo: "7 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "tudo", rotulo: "Tudo" },
];

// O recorte é calculado no fuso de quem está olhando: "hoje" é o dia do dono
// da barbearia, não o do servidor.
function intervalo(periodo: Periodo) {
  if (periodo === "tudo") return {};

  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
  if (periodo === "mes") inicio.setDate(1);

  return { de: inicio.toISOString(), ate: fim.toISOString() };
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  className = "",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-zinc-200 p-4 ${className}`}>
      <p className="text-base leading-6 text-zinc-700">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums">
        {valor}
      </p>
      {detalhe && (
        <p className="mt-1 text-base leading-6 text-zinc-700">{detalhe}</p>
      )}
    </div>
  );
}

function TabelaResumo({
  titulo,
  coluna,
  linhas,
  totalCentavos,
}: {
  titulo: string;
  coluna: string;
  linhas: ResumoFinanceiro["porFormaPagamento"];
  totalCentavos: number;
}) {
  return (
    <section
      aria-label={titulo}
      className="overflow-hidden rounded-lg border border-zinc-200"
    >
      <h2 className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-semibold leading-6">
        {titulo}
      </h2>
      {linhas.length === 0 ? (
        <p className="px-4 py-6 text-center text-base leading-6 text-zinc-700">
          Nada no período.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead className="sr-only">
            <tr>
              <th>{coluna}</th>
              <th>Atendimentos</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const fatia = totalCentavos
                ? Math.round((linha.totalCentavos / totalCentavos) * 100)
                : 0;
              return (
                <tr key={linha.rotulo} className="border-b border-zinc-200">
                  <td className="px-4 py-3 text-base leading-6">
                    {linha.rotulo}
                    <span className="block text-base leading-6 text-zinc-700 tabular-nums">
                      {linha.quantidade}{" "}
                      {linha.quantidade === 1 ? "atendimento" : "atendimentos"}{" "}
                      · {fatia}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-base font-semibold leading-6 tabular-nums">
                    {formatarPreco(linha.totalCentavos)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function FinanceiroPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (periodoAtual: Periodo) => {
    setCarregando(true);
    setErro(null);
    try {
      const { de, ate } = intervalo(periodoAtual);
      const busca = new URLSearchParams();
      if (de) busca.set("de", de);
      if (ate) busca.set("ate", ate);
      const query = busca.toString();
      const dados = (await authFetch(
        `/atendimentos/resumo${query ? `?${query}` : ""}`,
      )) as ResumoFinanceiro;
      setResumo(dados);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o resumo.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    queueMicrotask(() => {
      if (ativo) void carregar(periodo);
    });
    return () => {
      ativo = false;
    };
  }, [carregar, periodo]);

  const rotuloPeriodo =
    PERIODOS.find((item) => item.valor === periodo)?.rotulo ?? "";

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-8">Financeiro</h1>
          <p className="mt-1 text-base leading-6 text-zinc-700">
            Quanto a barbearia já recebeu, pelos atendimentos concluídos.
          </p>
        </div>
      </header>

      <div
        role="group"
        aria-label="Período"
        className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PERIODOS.map((item) => (
          <button
            key={item.valor}
            type="button"
            aria-pressed={periodo === item.valor}
            onClick={() => setPeriodo(item.valor)}
            className={`min-h-11 shrink-0 rounded-md border px-4 py-2 text-base font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 ${
              periodo === item.valor
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-base leading-6 text-red-800"
        >
          <AlertCircle
            aria-hidden="true"
            size={20}
            className="mt-0.5 shrink-0"
          />
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => void carregar(periodo)}
            className="ml-auto min-h-11 shrink-0 rounded-md border border-red-300 px-3 py-2 text-base font-semibold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {carregando ? (
        <div aria-label="Carregando resumo" aria-busy="true" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, indice) => (
              <div
                key={indice}
                className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 motion-reduce:animate-none"
              />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 motion-reduce:animate-none" />
        </div>
      ) : resumo && resumo.quantidade > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Indicador
              className="col-span-2 sm:col-span-1"
              rotulo={`Recebido · ${rotuloPeriodo}`}
              valor={formatarPreco(resumo.totalCentavos)}
            />
            <Indicador
              rotulo="Atendimentos"
              valor={String(resumo.quantidade)}
            />
            <Indicador
              rotulo="Ticket médio"
              valor={formatarPreco(resumo.ticketMedioCentavos)}
            />
          </div>

          <TabelaResumo
            titulo="Por forma de pagamento"
            coluna="Forma de pagamento"
            linhas={resumo.porFormaPagamento}
            totalCentavos={resumo.totalCentavos}
          />
          <TabelaResumo
            titulo="Por serviço"
            coluna="Serviço"
            linhas={resumo.porServico}
            totalCentavos={resumo.totalCentavos}
          />
          <TabelaResumo
            titulo="Por profissional"
            coluna="Profissional"
            linhas={resumo.porProfissional}
            totalCentavos={resumo.totalCentavos}
          />
        </div>
      ) : (
        !erro && (
          <div className="rounded-lg border border-zinc-200 p-8 text-center">
            <Wallet
              aria-hidden="true"
              size={32}
              className="mx-auto text-zinc-500"
            />
            <p className="mt-3 text-base font-semibold leading-6">
              Nenhum atendimento concluído {rotuloPeriodo.toLowerCase()}
            </p>
            <p className="mt-1 text-base leading-6 text-zinc-700">
              O valor entra aqui quando um agendamento é marcado como concluído
              e a forma de pagamento é informada.
            </p>
          </div>
        )
      )}
    </div>
  );
}
