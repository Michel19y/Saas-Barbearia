"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  MessageCircle,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  X,
} from "lucide-react";
import AgendamentoDrawer, {
  type AgendamentoFormValues,
} from "@/components/AgendamentoDrawer";
import { CampoBusca } from "@/components/BuscaClientes";
import ClienteAvatar from "@/components/ClienteAvatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import FormaPagamentoDialog, {
  type PagamentoSelecionado,
} from "@/components/FormaPagamentoDialog";
import Toast from "@/components/Toast";
import { authFetch } from "@/lib/auth";
import type {
  Agendamento,
  Cliente,
  Servico,
  StatusAgendamento,
} from "@/lib/types";

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  NAO_COMPARECEU: "Não compareceu",
};

const STATUS_OPCOES = [
  "PENDENTE",
  "CONFIRMADO",
  "CONCLUIDO",
  "CANCELADO",
  "NAO_COMPARECEU",
] as const satisfies readonly StatusAgendamento[];
type FiltroStatus = StatusAgendamento | "TODOS";

const BOTAO_ICONICO =
  "flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2";

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function nomeCliente(agendamento: Agendamento) {
  return agendamento.cliente?.nome ?? agendamento.clienteNome;
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function chaveData(iso: string) {
  const data = new Date(iso);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function formatarData(iso: string, formato: "curta" | "longa" = "curta") {
  const data = new Date(iso);
  return new Intl.DateTimeFormat(
    "pt-BR",
    formato === "longa"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(data);
}

function formatarHora(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatarPreco(precoCentavos: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(precoCentavos / 100);
}

function StatusSelect({
  agendamento,
  desabilitado,
  onChange,
}: {
  agendamento: Agendamento;
  desabilitado: boolean;
  onChange: (status: StatusAgendamento, trigger: HTMLElement) => void;
}) {
  return (
    <select
      value={agendamento.status}
      disabled={desabilitado}
      aria-label={`Status do agendamento de ${nomeCliente(agendamento)}`}
      onChange={(event) => {
        const status = STATUS_OPCOES.find(
          (opcao) => opcao === event.currentTarget.value,
        );
        if (status) onChange(status, event.currentTarget);
      }}
      className="campo-select min-h-11 max-w-full rounded-md border border-zinc-300 bg-white px-2 text-base leading-6 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:opacity-70"
    >
      {STATUS_OPCOES.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABEL[status]}
        </option>
      ))}
    </select>
  );
}

function AcoesAgendamento({
  agendamento,
  onEditar,
  onCancelar,
  mobile = false,
}: {
  agendamento: Agendamento;
  onEditar: (agendamento: Agendamento, trigger: HTMLElement) => void;
  onCancelar: (agendamento: Agendamento, trigger: HTMLElement) => void;
  mobile?: boolean;
}) {
  const nome = nomeCliente(agendamento);
  const digitos = somenteDigitos(agendamento.cliente?.telefone ?? "");

  return (
    <div
      className={`relative z-10 flex items-center gap-2 ${mobile ? "pointer-events-auto md:hidden" : "hidden justify-end md:flex"}`}
    >
      {mobile && digitos && (
        <>
          <a
            href={`https://wa.me/55${digitos}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Conversar com ${nome} no WhatsApp`}
            className={BOTAO_ICONICO}
          >
            <MessageCircle aria-hidden="true" size={20} />
          </a>
          <a
            href={`tel:${digitos}`}
            aria-label={`Ligar para ${nome}`}
            className={BOTAO_ICONICO}
          >
            <Phone aria-hidden="true" size={20} />
          </a>
        </>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEditar(agendamento, event.currentTarget);
        }}
        aria-label={`Editar agendamento de ${nome}`}
        className={BOTAO_ICONICO}
      >
        <Pencil aria-hidden="true" size={20} />
      </button>
      {mobile ? (
        agendamento.status !== "CANCELADO" && (
          <details
            className="relative"
            onClick={(event) => event.stopPropagation()}
          >
            <summary
              aria-label={`Mais ações para ${nome}`}
              className={`${BOTAO_ICONICO} list-none [&::-webkit-details-marker]:hidden`}
            >
              <MoreVertical aria-hidden="true" size={20} />
            </summary>
            <div className="absolute right-0 bottom-full z-20 mb-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelar(agendamento, event.currentTarget);
                }}
                className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-3 text-base font-semibold text-red-700 shadow-lg hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              >
                <X aria-hidden="true" size={16} />
                Cancelar agendamento
              </button>
            </div>
          </details>
        )
      ) : (
        <button
          type="button"
          disabled={agendamento.status === "CANCELADO"}
          onClick={(event) => {
            event.stopPropagation();
            onCancelar(agendamento, event.currentTarget);
          }}
          aria-label={`Cancelar agendamento de ${nome}`}
          className={`${BOTAO_ICONICO} text-red-700 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <X aria-hidden="true" size={20} />
        </button>
      )}
    </div>
  );
}

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [drawer, setDrawer] = useState<Agendamento | null | undefined>(
    undefined,
  );
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] =
    useState<Agendamento | null>(null);
  const [agendamentoParaConcluir, setAgendamentoParaConcluir] =
    useState<Agendamento | null>(null);
  const [statusEmAtualizacao, setStatusEmAtualizacao] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [agendamentoDestacado, setAgendamentoDestacado] = useState<
    string | null
  >(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const dispensarToast = useCallback(() => setToast(null), []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const [agendaData, clientesData, servicosData] = await Promise.all([
        authFetch("/agendamentos"),
        authFetch("/clientes"),
        authFetch("/servicos"),
      ]);
      setAgendamentos(agendaData as Agendamento[]);
      setClientes(clientesData as Cliente[]);
      setServicos(servicosData as Servico[]);
    } catch (error) {
      setErroCarga(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os agendamentos.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    queueMicrotask(() => {
      if (ativo) {
        setDiaSelecionado(hojeLocal());
        void carregar();
      }
    });
    return () => {
      ativo = false;
    };
  }, [carregar]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setBuscaAplicada(termo.trim()),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [termo]);

  const agendamentosFiltrados = useMemo(() => {
    const buscaNormalizada = normalizar(buscaAplicada);
    const buscaNumerica = somenteDigitos(buscaAplicada);
    return agendamentos
      .filter((agendamento) => {
        if (
          diaSelecionado &&
          chaveData(agendamento.inicio) !== diaSelecionado
        ) {
          return false;
        }
        if (
          filtroStatus !== "TODOS" &&
          agendamento.status !== filtroStatus
        ) {
          return false;
        }
        if (!buscaNormalizada && !buscaNumerica) return true;
        return (
          normalizar(nomeCliente(agendamento)).includes(buscaNormalizada) ||
          normalizar(agendamento.servico.nome).includes(buscaNormalizada) ||
          normalizar(agendamento.observacao ?? "").includes(buscaNormalizada) ||
          Boolean(
            buscaNumerica &&
              somenteDigitos(agendamento.cliente?.telefone ?? "").includes(
                buscaNumerica,
              ),
          )
        );
      })
      .sort(
        (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
      );
  }, [agendamentos, buscaAplicada, diaSelecionado, filtroStatus]);

  const grupos = useMemo(() => {
    const agrupados = new Map<string, Agendamento[]>();
    for (const agendamento of agendamentosFiltrados) {
      const chave = chaveData(agendamento.inicio);
      const lista = agrupados.get(chave) ?? [];
      lista.push(agendamento);
      agrupados.set(chave, lista);
    }
    return Array.from(agrupados.entries());
  }, [agendamentosFiltrados]);
  const servicosAtivos = useMemo(
    () => servicos.filter((servico) => servico.ativo),
    [servicos],
  );

  function registrarFoco(trigger?: HTMLElement | null) {
    focoAnterior.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
  }

  function devolverFoco() {
    const elemento = focoAnterior.current;
    window.requestAnimationFrame(() => elemento?.focus());
  }

  function abrirDrawer(
    agendamento: Agendamento | null,
    trigger?: HTMLElement | null,
  ) {
    registrarFoco(trigger);
    setDrawer(agendamento);
  }

  function fecharDrawer() {
    setDrawer(undefined);
    devolverFoco();
  }

  function abrirConfirmacao(
    agendamento: Agendamento,
    trigger: HTMLElement,
  ) {
    registrarFoco(trigger);
    setAgendamentoParaCancelar(agendamento);
  }

  function fecharConfirmacao() {
    setAgendamentoParaCancelar(null);
    devolverFoco();
  }

  function destacar(id: string) {
    setAgendamentoDestacado(id);
    window.setTimeout(() => {
      setAgendamentoDestacado((atual) => (atual === id ? null : atual));
    }, 2500);
  }

  async function salvarAgendamento(values: AgendamentoFormValues) {
    const payload = {
      clienteId: values.clienteId || undefined,
      clienteNome: values.clienteId ? undefined : values.clienteNome,
      servicoId: values.servicoId,
      inicio: new Date(values.inicio).toISOString(),
      observacao: values.observacao || undefined,
    };

    if (drawer) {
      const atualizado = (await authFetch(`/agendamentos/${drawer.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })) as Agendamento;
      setAgendamentos((atuais) =>
        atuais.map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
      destacar(atualizado.id);
      setToast(`Agendamento de ${nomeCliente(atualizado)} atualizado`);
    } else {
      const criado = (await authFetch("/agendamentos", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as Agendamento;
      setAgendamentos((atuais) => [...atuais, criado]);
      destacar(criado.id);
      setToast(`Agendamento de ${nomeCliente(criado)} criado`);
    }
    fecharDrawer();
  }

  async function atualizarStatus(
    agendamento: Agendamento,
    status: StatusAgendamento,
    pagamento?: PagamentoSelecionado,
  ) {
    setErroAcao(null);
    setStatusEmAtualizacao(agendamento.id);
    try {
      const atualizado = (await authFetch(`/agendamentos/${agendamento.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...pagamento,
        }),
      })) as Agendamento;
      setAgendamentos((atuais) =>
        atuais.map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
      setToast(
        `Status do agendamento de ${nomeCliente(atualizado)} atualizado`,
      );
    } catch (error) {
      if (!pagamento) {
        setErroAcao(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o status do agendamento.",
        );
      }
      throw error;
    } finally {
      setStatusEmAtualizacao(null);
    }
  }

  function selecionarStatus(
    agendamento: Agendamento,
    status: StatusAgendamento,
    trigger: HTMLElement,
  ) {
    if (status === "CANCELADO") {
      abrirConfirmacao(agendamento, trigger);
      return;
    }
    if (status === "CONCLUIDO") {
      registrarFoco(trigger);
      setAgendamentoParaConcluir(agendamento);
      return;
    }
    void atualizarStatus(agendamento, status).catch(() => undefined);
  }

  function fecharPagamento() {
    setAgendamentoParaConcluir(null);
    devolverFoco();
  }

  async function concluirComPagamento(pagamento: PagamentoSelecionado) {
    if (!agendamentoParaConcluir) return;
    await atualizarStatus(
      agendamentoParaConcluir,
      "CONCLUIDO",
      pagamento,
    );
    setAgendamentoParaConcluir(null);
    devolverFoco();
  }

  async function cancelarAgendamento() {
    if (!agendamentoParaCancelar) return;
    await authFetch(`/agendamentos/${agendamentoParaCancelar.id}`, {
      method: "DELETE",
    });
    setAgendamentos((atuais) =>
      atuais.map((item) =>
        item.id === agendamentoParaCancelar.id
          ? { ...item, status: "CANCELADO" }
          : item,
      ),
    );
    setToast(
      `Agendamento de ${nomeCliente(agendamentoParaCancelar)} cancelado`,
    );
    setAgendamentoParaCancelar(null);
    devolverFoco();
  }

  const totalPrevisto = agendamentosFiltrados
    .filter((agendamento) => agendamento.status !== "CANCELADO")
    .reduce(
      (total, agendamento) =>
        total + agendamento.servico.precoCentavos,
      0,
    );

  const rotuloContagem =
    agendamentosFiltrados.length === 1
      ? "1 agendamento"
      : `${agendamentosFiltrados.length} agendamentos`;
  const hoje = hojeLocal();

  return (
    <div className="space-y-6 pb-24 md:space-y-8 md:pb-0">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-8">Agendamentos</h1>
          <p className="mt-1 text-base leading-6 text-zinc-700">
            {rotuloContagem} · Total previsto {formatarPreco(totalPrevisto)}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => abrirDrawer(null, event.currentTarget)}
          disabled={carregando || Boolean(erroCarga)}
          className="hidden min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 md:flex"
        >
          <Plus aria-hidden="true" size={20} />
          Novo agendamento
        </button>
      </header>

      {erroAcao && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-base leading-6 text-red-800"
        >
          <AlertCircle aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <span>{erroAcao}</span>
          <button
            type="button"
            aria-label="Fechar mensagem de erro"
            onClick={() => setErroAcao(null)}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
      )}

      <section aria-label="Lista de agendamentos" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)_15rem] md:items-end">
          <CampoBusca
            value={termo}
            onChange={setTermo}
            id="buscar-agendamentos"
            label="Buscar agendamentos"
            placeholder="Buscar por cliente, telefone ou serviço"
          />
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="filtro-data"
                className="mb-1 block text-sm font-semibold leading-6 text-zinc-800"
              >
                Dia
              </label>
              <input
                id="filtro-data"
                type="date"
                value={diaSelecionado ?? ""}
                onChange={(event) =>
                  setDiaSelecionado(event.target.value || null)
                }
                className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setDiaSelecionado((atual) =>
                  atual === hoje ? null : hoje,
                )
              }
              aria-label={
                diaSelecionado === hoje
                  ? "Mostrar todos os dias"
                  : "Mostrar agendamentos de hoje"
              }
              className="min-h-11 shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-base font-semibold text-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              {diaSelecionado === hoje ? "Ver todos" : "Hoje"}
            </button>
          </div>
          <div>
            <label htmlFor="filtro-status" className="sr-only">
              Filtrar por status
            </label>
            <select
              id="filtro-status"
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(event.target.value as FiltroStatus)
              }
              className="campo-select min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              <option value="TODOS">Todos os status</option>
              {STATUS_OPCOES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {carregando ? (
          <div
            aria-label="Carregando agendamentos"
            aria-busy="true"
            className="space-y-3"
          >
            <div className="hidden overflow-hidden rounded-lg border border-zinc-200 md:block">
              <div className="h-12 animate-pulse bg-zinc-100 motion-reduce:animate-none" />
              {Array.from({ length: 5 }, (_, indice) => (
                <div
                  key={indice}
                  className="h-16 border-t border-zinc-200 bg-white"
                >
                  <div className="m-4 h-6 animate-pulse rounded bg-zinc-100 motion-reduce:animate-none" />
                </div>
              ))}
            </div>
            <ul className="space-y-3 md:hidden">
              {Array.from({ length: 5 }, (_, indice) => (
                <li
                  key={indice}
                  className="h-32 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 motion-reduce:animate-none"
                />
              ))}
            </ul>
          </div>
        ) : erroCarga ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
          >
            <AlertCircle
              aria-hidden="true"
              size={32}
              className="mx-auto text-red-700"
            />
            <p className="mt-3 text-base leading-6 text-red-800">
              Não foi possível carregar os agendamentos. {erroCarga}
            </p>
            <button
              type="button"
              onClick={() => void carregar()}
              className="mt-4 min-h-11 rounded-md border border-zinc-300 bg-white px-4 py-2 text-base font-semibold text-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        ) : agendamentos.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 px-6 py-12 text-center">
            <CalendarClock
              aria-hidden="true"
              size={48}
              strokeWidth={1.5}
              className="mx-auto text-zinc-600"
            />
            <h2 className="mt-4 text-lg font-semibold leading-6">
              Você ainda não tem agendamentos
            </h2>
            <p className="mt-2 text-base leading-6 text-zinc-700">
              Crie um horário para organizar os próximos atendimentos.
            </p>
            <button
              type="button"
              onClick={(event) => abrirDrawer(null, event.currentTarget)}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              <Plus aria-hidden="true" size={20} />
              Criar primeiro agendamento
            </button>
          </div>
        ) : agendamentosFiltrados.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 px-6 py-10 text-center">
            <p className="text-base leading-6 text-zinc-800">
              {diaSelecionado
                ? `Nenhum agendamento para ${diaSelecionado === hoje ? "hoje" : formatarData(`${diaSelecionado}T12:00:00`)}.`
                : "Nenhum agendamento encontrado com esses filtros."}
            </p>
            <button
              type="button"
              onClick={() => {
                setTermo("");
                setFiltroStatus("TODOS");
                setDiaSelecionado(null);
              }}
              className="mt-4 min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-base font-semibold text-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              Ver todos os agendamentos
            </button>
          </div>
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {agendamentosFiltrados.length} agendamentos encontrados
            </p>

            <div className="space-y-3 md:hidden">
              {grupos.map(([data, grupo]) => (
                <section key={data} aria-label={`Agendamentos de ${data}`}>
                  <h2 className="sticky top-0 z-10 -mx-1 bg-zinc-50 px-1 py-2 text-base font-semibold leading-6 text-zinc-800">
                    {formatarData(grupo[0].inicio, "longa")}
                  </h2>
                  <ul className="space-y-3">
                    {grupo.map((agendamento) => (
                      <li
                        key={agendamento.id}
                        className={`relative rounded-lg border p-4 transition-colors motion-reduce:transition-none ${agendamentoDestacado === agendamento.id ? "border-green-700 bg-green-50" : "border-zinc-200 bg-white"}`}
                      >
                        <button
                          type="button"
                          onClick={(event) =>
                            abrirDrawer(agendamento, event.currentTarget)
                          }
                          aria-label={`Editar agendamento de ${nomeCliente(agendamento)}`}
                          className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                        />
                        <div className="relative z-10 pointer-events-none flex items-start gap-3">
                          <ClienteAvatar nome={nomeCliente(agendamento)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold leading-6 text-zinc-950">
                              {nomeCliente(agendamento)}
                            </p>
                            {!agendamento.clienteId && (
                              <p className="text-sm leading-6 text-zinc-700">
                                Anotação rápida · sem cadastro
                              </p>
                            )}
                            <p className="text-base leading-6 text-zinc-800">
                              {agendamento.servico.nome} ·{" "}
                              {formatarPreco(
                                agendamento.servico.precoCentavos,
                              )}
                            </p>
                            <p className="mt-1 flex items-center gap-2 text-base leading-6 text-zinc-700 tabular-nums">
                              <CalendarClock
                                aria-hidden="true"
                                size={16}
                                className="shrink-0"
                              />
                              {formatarHora(agendamento.inicio)}
                            </p>
                            {agendamento.observacao && (
                              <p className="mt-1 break-words text-sm leading-6 text-zinc-700">
                                {agendamento.observacao}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="relative z-10 mt-3 flex flex-wrap items-center justify-between gap-2">
                          <StatusSelect
                            agendamento={agendamento}
                            desabilitado={
                              statusEmAtualizacao === agendamento.id
                            }
                            onChange={(status, trigger) =>
                              selecionarStatus(agendamento, status, trigger)
                            }
                          />
                          <AcoesAgendamento
                            mobile
                            agendamento={agendamento}
                            onEditar={(alvo, trigger) =>
                              abrirDrawer(alvo, trigger)
                            }
                            onCancelar={abrirConfirmacao}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="hidden md:block">
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-zinc-100">
                  <tr>
                    <th
                      scope="col"
                      className="rounded-tl-lg px-4 py-3 text-base font-semibold leading-6"
                    >
                      Horário
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-base font-semibold leading-6"
                    >
                      Cliente
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-base font-semibold leading-6"
                    >
                      Serviço
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-base font-semibold leading-6"
                    >
                      Valor
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-base font-semibold leading-6"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="rounded-tr-lg px-4 py-3 text-right text-base font-semibold leading-6"
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                {grupos.map(([data, grupo]) => (
                  <tbody key={data}>
                    <tr>
                      <th
                        scope="rowgroup"
                        colSpan={6}
                        className="sticky top-12 z-[5] border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-left text-base font-semibold leading-6 text-zinc-800"
                      >
                        {formatarData(grupo[0].inicio, "longa")}
                      </th>
                    </tr>
                    {grupo.map((agendamento) => (
                      <tr
                        key={agendamento.id}
                        className={`bg-white ${agendamentoDestacado === agendamento.id ? "!bg-green-50" : ""}`}
                      >
                        <td className="border-b border-zinc-200 px-4 py-3">
                          <time
                            dateTime={agendamento.inicio}
                            className="block text-base font-semibold leading-6 tabular-nums"
                          >
                            {formatarHora(agendamento.inicio)}
                          </time>
                          <span className="text-sm leading-6 text-zinc-700 tabular-nums">
                            até {formatarHora(agendamento.fim)}
                          </span>
                        </td>
                        <td className="border-b border-zinc-200 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ClienteAvatar nome={nomeCliente(agendamento)} />
                            <div>
                              <span className="text-base font-semibold leading-6">
                                {nomeCliente(agendamento)}
                              </span>
                              {!agendamento.clienteId && (
                                <span className="block text-sm leading-6 text-zinc-700">
                                  Anotação rápida · sem cadastro
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-zinc-200 px-4 py-3 text-base leading-6">
                          {agendamento.servico.nome}
                          {agendamento.observacao && (
                            <span
                              className="block max-w-56 truncate text-sm leading-6 text-zinc-700"
                              title={agendamento.observacao}
                            >
                              {agendamento.observacao}
                            </span>
                          )}
                        </td>
                        <td className="border-b border-zinc-200 px-4 py-3 text-base leading-6 tabular-nums">
                          {formatarPreco(agendamento.servico.precoCentavos)}
                        </td>
                        <td className="border-b border-zinc-200 px-4 py-2">
                          <StatusSelect
                            agendamento={agendamento}
                            desabilitado={
                              statusEmAtualizacao === agendamento.id
                            }
                            onChange={(status, trigger) =>
                              selecionarStatus(agendamento, status, trigger)
                            }
                          />
                        </td>
                        <td className="border-b border-zinc-200 px-4 py-2">
                          <AcoesAgendamento
                            agendamento={agendamento}
                            onEditar={(alvo, trigger) =>
                              abrirDrawer(alvo, trigger)
                            }
                            onCancelar={abrirConfirmacao}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
                <tfoot>
                  <tr className="bg-zinc-50">
                    <th
                      scope="row"
                      colSpan={3}
                      className="rounded-bl-lg border-t border-zinc-200 px-4 py-3 text-right text-base font-semibold leading-6"
                    >
                      Total previsto (exceto cancelados)
                    </th>
                    <td className="border-t border-zinc-200 px-4 py-3 text-base font-semibold leading-6 tabular-nums">
                      {formatarPreco(totalPrevisto)}
                    </td>
                    <td
                      colSpan={2}
                      className="rounded-br-lg border-t border-zinc-200"
                    />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
        <button
          type="button"
          onClick={(event) => abrirDrawer(null, event.currentTarget)}
          disabled={carregando || Boolean(erroCarga)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
        >
          <Plus aria-hidden="true" size={20} />
          Novo agendamento
        </button>
      </div>

      {drawer !== undefined && (
        <AgendamentoDrawer
          key={drawer?.id ?? "novo"}
          agendamento={drawer}
          dataInicial={diaSelecionado ?? hojeLocal()}
          clientes={clientes}
          servicos={servicosAtivos}
          onClose={fecharDrawer}
          onSave={salvarAgendamento}
        />
      )}

      {agendamentoParaCancelar && (
        <ConfirmDialog
          title={`Cancelar agendamento de ${nomeCliente(agendamentoParaCancelar)}?`}
          description={`A alteração do status para Cancelado também pode ser feita depois na lista. Horário: ${formatarData(agendamentoParaCancelar.inicio)} às ${formatarHora(agendamentoParaCancelar.inicio)}.`}
          confirmLabel="Cancelar agendamento"
          loadingLabel="Cancelando…"
          confirmIcon={<X aria-hidden="true" size={20} />}
          onCancel={fecharConfirmacao}
          onConfirm={cancelarAgendamento}
        />
      )}

      {agendamentoParaConcluir && (
        <FormaPagamentoDialog
          agendamento={agendamentoParaConcluir}
          onCancel={fecharPagamento}
          onConfirm={concluirComPagamento}
        />
      )}

      {toast && (
        <Toast message={toast} onDismiss={dispensarToast} />
      )}
    </div>
  );
}
