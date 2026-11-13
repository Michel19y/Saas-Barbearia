"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Clock,
  Pencil,
  Plus,
  Trash2,
  Scissors,
  X,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import ServicoDrawer, {
  type ServicoFormValues,
} from "@/components/ServicoDrawer";
import Toast from "@/components/Toast";
import { authFetch } from "@/lib/auth";
import { formatarPreco } from "@/lib/formato";
import type { Servico } from "@/lib/types";

const BOTAO_ICONICO =
  "flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2";

function ServicoActions({
  servico,
  onEditar,
  onDesativar,
  mobile = false,
}: {
  servico: Servico;
  onEditar: (servico: Servico, trigger: HTMLElement) => void;
  onDesativar: (servico: Servico, trigger: HTMLElement) => void;
  mobile?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${mobile ? "mt-3 md:hidden" : "hidden justify-end md:flex"}`}
    >
      <button
        type="button"
        onClick={(event) => onEditar(servico, event.currentTarget)}
        aria-label={`Editar ${servico.nome}`}
        className={BOTAO_ICONICO}
      >
        <Pencil aria-hidden="true" size={20} />
      </button>
      <button
        type="button"
        onClick={(event) => onDesativar(servico, event.currentTarget)}
        aria-label={`Desativar ${servico.nome}`}
        className={`${BOTAO_ICONICO} text-red-700 hover:bg-red-50 hover:text-red-800`}
      >
        <Trash2 aria-hidden="true" size={20} />
      </button>
    </div>
  );
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ servico: Servico | null } | null>(
    null,
  );
  const [servicoParaDesativar, setServicoParaDesativar] =
    useState<Servico | null>(null);
  const [servicoDestacado, setServicoDestacado] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const resultado = (await authFetch("/servicos")) as Servico[];
      setServicos(resultado);
    } catch (error) {
      setErroCarga(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os serviços.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    queueMicrotask(() => {
      if (ativo) void carregar();
    });
    return () => {
      ativo = false;
    };
  }, [carregar]);

  function destacar(id: string) {
    setServicoDestacado(id);
    window.setTimeout(
      () => setServicoDestacado((atual) => (atual === id ? null : atual)),
      2000,
    );
  }

  function abrirDrawer(servico: Servico | null, trigger: HTMLElement) {
    gatilhoRef.current = trigger;
    setDrawer({ servico });
  }

  function fecharDrawer() {
    setDrawer(null);
    gatilhoRef.current?.focus();
  }

  function abrirConfirmacao(servico: Servico, trigger: HTMLElement) {
    gatilhoRef.current = trigger;
    setServicoParaDesativar(servico);
  }

  function fecharConfirmacao() {
    setServicoParaDesativar(null);
    gatilhoRef.current?.focus();
  }

  const dispensarToast = useCallback(() => setToast(null), []);

  async function salvarServico(values: ServicoFormValues) {
    const emEdicao = drawer?.servico ?? null;
    setErroAcao(null);
    if (emEdicao) {
      const atualizado = (await authFetch(`/servicos/${emEdicao.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      })) as Servico;
      setServicos((atuais) =>
        atuais.map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
      destacar(atualizado.id);
      setToast(`Serviço ${atualizado.nome} atualizado`);
    } else {
      const criado = (await authFetch("/servicos", {
        method: "POST",
        body: JSON.stringify(values),
      })) as Servico;
      setServicos((atuais) => [...atuais, criado]);
      destacar(criado.id);
      setToast(`Serviço ${criado.nome} cadastrado`);
    }
    fecharDrawer();
  }

  async function desativarServico() {
    if (!servicoParaDesativar) return;
    await authFetch(`/servicos/${servicoParaDesativar.id}`, {
      method: "DELETE",
    });
    setServicos((atuais) =>
      atuais.filter((item) => item.id !== servicoParaDesativar.id),
    );
    setServicoParaDesativar(null);
    setToast(`${servicoParaDesativar.nome} foi desativado`);
  }

  const contagem =
    servicos.length === 1 ? "1 serviço" : `${servicos.length} serviços`;

  return (
    <div className="space-y-6 pb-24 md:space-y-8 md:pb-0">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-8">Serviços</h1>
          <p className="mt-1 text-base leading-6 text-zinc-700">
            {carregando ? "Carregando…" : contagem}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => abrirDrawer(null, event.currentTarget)}
          className="hidden min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 md:flex"
        >
          <Plus aria-hidden="true" size={20} />
          Novo serviço
        </button>
      </header>

      {erroAcao && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-base leading-6 text-red-800"
        >
          <AlertCircle
            aria-hidden="true"
            size={20}
            className="mt-0.5 shrink-0"
          />
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

      <section aria-label="Lista de serviços" className="space-y-4">
        {carregando ? (
          <div
            aria-label="Carregando serviços"
            aria-busy="true"
            className="space-y-3"
          >
            {Array.from({ length: 4 }, (_, indice) => (
              <div
                key={indice}
                className="h-20 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : erroCarga ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-base leading-6 text-red-800"
          >
            <AlertCircle
              aria-hidden="true"
              size={20}
              className="mt-0.5 shrink-0"
            />
            <span>{erroCarga}</span>
            <button
              type="button"
              onClick={() => void carregar()}
              className="ml-auto min-h-11 shrink-0 rounded-md border border-red-300 px-3 py-2 text-base font-semibold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              Tentar de novo
            </button>
          </div>
        ) : servicos.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 p-8 text-center">
            <Scissors
              aria-hidden="true"
              size={32}
              className="mx-auto text-zinc-500"
            />
            <p className="mt-3 text-base font-semibold leading-6">
              Nenhum serviço cadastrado ainda
            </p>
            <p className="mt-1 text-base leading-6 text-zinc-700">
              Cadastre os serviços para montar a agenda e abrir a página de
              agendamento.
            </p>
            <button
              type="button"
              onClick={(event) => abrirDrawer(null, event.currentTarget)}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-base font-semibold hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              <Plus aria-hidden="true" size={20} />
              Cadastrar primeiro serviço
            </button>
          </div>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {servicos.map((servico) => (
                <li
                  key={servico.id}
                  className={`rounded-lg border border-zinc-200 p-4 ${servicoDestacado === servico.id ? "bg-green-50" : "bg-white"}`}
                >
                  <p className="text-base font-semibold leading-6">
                    {servico.nome}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-base leading-6 text-zinc-700 tabular-nums">
                    <Clock aria-hidden="true" size={16} />
                    {servico.duracaoMin} min ·{" "}
                    {formatarPreco(servico.precoCentavos)}
                  </p>
                  <ServicoActions
                    mobile
                    servico={servico}
                    onEditar={abrirDrawer}
                    onDesativar={abrirConfirmacao}
                  />
                </li>
              ))}
            </ul>

            <div className="hidden overflow-hidden rounded-lg border border-zinc-200 md:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Serviços cadastrados na barbearia
                </caption>
                <thead>
                  <tr className="bg-zinc-50">
                    <th className="border-b border-zinc-200 px-4 py-3 text-base font-semibold leading-6">
                      Serviço
                    </th>
                    <th className="border-b border-zinc-200 px-4 py-3 text-base font-semibold leading-6">
                      Duração
                    </th>
                    <th className="border-b border-zinc-200 px-4 py-3 text-base font-semibold leading-6">
                      Preço
                    </th>
                    <th className="border-b border-zinc-200 px-4 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((servico) => (
                    <tr
                      key={servico.id}
                      className={
                        servicoDestacado === servico.id
                          ? "bg-green-50"
                          : "bg-white"
                      }
                    >
                      <td className="border-b border-zinc-200 px-4 py-3 text-base font-semibold leading-6">
                        {servico.nome}
                      </td>
                      <td className="border-b border-zinc-200 px-4 py-3 text-base leading-6 tabular-nums">
                        {servico.duracaoMin} min
                      </td>
                      <td className="border-b border-zinc-200 px-4 py-3 text-base leading-6 tabular-nums">
                        {formatarPreco(servico.precoCentavos)}
                      </td>
                      <td className="border-b border-zinc-200 px-4 py-2">
                        <ServicoActions
                          servico={servico}
                          onEditar={abrirDrawer}
                          onDesativar={abrirConfirmacao}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
        <button
          type="button"
          onClick={(event) => abrirDrawer(null, event.currentTarget)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
        >
          <Plus aria-hidden="true" size={20} />
          Novo serviço
        </button>
      </div>

      {drawer && (
        <ServicoDrawer
          key={drawer.servico?.id ?? "novo"}
          servico={drawer.servico}
          onClose={fecharDrawer}
          onSave={salvarServico}
        />
      )}

      {servicoParaDesativar && (
        <ConfirmDialog
          title={`Desativar ${servicoParaDesativar.nome}?`}
          description="Ele deixa de aparecer na página de agendamento e nos novos agendamentos. Os agendamentos já marcados não mudam."
          confirmLabel="Desativar"
          loadingLabel="Desativando…"
          onCancel={fecharConfirmacao}
          onConfirm={desativarServico}
          getErrorMessage={(error) =>
            error instanceof Error
              ? error.message
              : "Não foi possível desativar o serviço."
          }
        />
      )}

      {toast && <Toast message={toast} onDismiss={dispensarToast} />}
    </div>
  );
}
