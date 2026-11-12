"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  MessageCircle,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import BuscaClientes from "@/components/BuscaClientes";
import ClienteAvatar from "@/components/ClienteAvatar";
import ClienteDrawer, {
  type ClienteFormValues,
} from "@/components/ClienteDrawer";
import ConfirmDialog from "@/components/ConfirmDialog";
import Toast from "@/components/Toast";
import { authFetch } from "@/lib/auth";
import type { Cliente } from "@/lib/types";

const BOTAO_ICONICO =
  "flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2";

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function digitosTelefone(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarTelefone(valor: string) {
  const digitos = digitosTelefone(valor);
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return valor;
}

function NomeDestacado({ nome, termo }: { nome: string; termo: string }) {
  const busca = normalizar(termo.trim());
  if (!busca) return nome;

  let nomeNormalizado = "";
  const inicioOriginal: number[] = [];
  const fimOriginal: number[] = [];
  for (let indice = 0; indice < nome.length; ) {
    const codigo = nome.codePointAt(indice);
    if (codigo === undefined) break;
    const caractere = String.fromCodePoint(codigo);
    const normalizado = normalizar(caractere);
    nomeNormalizado += normalizado;
    for (let posicao = 0; posicao < normalizado.length; posicao += 1) {
      inicioOriginal.push(indice);
      fimOriginal.push(indice + caractere.length);
    }
    indice += caractere.length;
  }

  const inicio = nomeNormalizado.indexOf(busca);
  if (inicio < 0) return nome;
  const primeiro = inicioOriginal[inicio];
  const ultimo = fimOriginal[inicio + busca.length - 1];
  if (primeiro === undefined || ultimo === undefined) return nome;

  return (
    <>
      {nome.slice(0, primeiro)}
      <mark className="rounded bg-amber-100 px-0.5 text-zinc-950">
        {nome.slice(primeiro, ultimo)}
      </mark>
      {nome.slice(ultimo)}
    </>
  );
}

function ClienteActions({
  cliente,
  onEditar,
  onExcluir,
  mobile = false,
}: {
  cliente: Cliente;
  onEditar: (cliente: Cliente, trigger: HTMLElement) => void;
  onExcluir: (cliente: Cliente, trigger: HTMLElement) => void;
  mobile?: boolean;
}) {
  const digitos = digitosTelefone(cliente.telefone ?? "");

  return (
    <div
      className={`relative z-10 flex items-center gap-2 ${mobile ? "pointer-events-auto mt-3 md:hidden" : "hidden justify-end md:flex"}`}
    >
      {digitos && (
        <>
          <a
            href={`https://wa.me/55${digitos}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Conversar com ${cliente.nome} no WhatsApp`}
            className={BOTAO_ICONICO}
          >
            <MessageCircle aria-hidden="true" size={20} />
          </a>
          <a
            href={`tel:${digitos}`}
            aria-label={`Ligar para ${cliente.nome}`}
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
          onEditar(cliente, event.currentTarget);
        }}
        aria-label={`Editar ${cliente.nome}`}
        className={BOTAO_ICONICO}
      >
        <Pencil aria-hidden="true" size={20} />
      </button>
      {mobile ? (
        <details
          className="relative"
          onClick={(event) => event.stopPropagation()}
        >
          <summary
            aria-label={`Mais ações para ${cliente.nome}`}
            className={`${BOTAO_ICONICO} list-none [&::-webkit-details-marker]:hidden`}
          >
            <MoreVertical aria-hidden="true" size={20} />
          </summary>
          <div className="absolute right-0 bottom-full z-20 mb-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onExcluir(cliente, event.currentTarget);
              }}
              className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-3 text-base font-semibold text-red-700 shadow-lg hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              <Trash2 aria-hidden="true" size={16} />
              Excluir
            </button>
          </div>
        </details>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onExcluir(cliente, event.currentTarget);
          }}
          aria-label={`Excluir ${cliente.nome}`}
          className={`${BOTAO_ICONICO} text-red-700 hover:bg-red-50 hover:text-red-800`}
        >
          <Trash2 aria-hidden="true" size={20} />
        </button>
      )}
    </div>
  );
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [drawer, setDrawer] = useState<{
    cliente: Cliente | null;
    nomeInicial: string;
  } | null>(null);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [clienteDestacado, setClienteDestacado] = useState<string | null>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const dispensarToast = useCallback(() => setToast(null), []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const resultado = (await authFetch("/clientes")) as Cliente[];
      setClientes(resultado);
    } catch (error) {
      setErroCarga(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os clientes.",
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

  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaAplicada(termo.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [termo]);

  const clientesFiltrados = useMemo(() => {
    const buscaNormalizada = normalizar(buscaAplicada);
    const buscaNumerica = digitosTelefone(buscaAplicada);
    return clientes
      .filter((cliente) => {
        if (!buscaNormalizada && !buscaNumerica) return true;
        return (
          normalizar(cliente.nome).includes(buscaNormalizada) ||
          normalizar(cliente.email ?? "").includes(buscaNormalizada) ||
          Boolean(
            buscaNumerica &&
              digitosTelefone(cliente.telefone ?? "").includes(buscaNumerica),
          )
        );
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [buscaAplicada, clientes]);

  const grupos = useMemo(() => {
    const agrupados = new Map<string, Cliente[]>();
    for (const cliente of clientesFiltrados) {
      const inicial = normalizar(cliente.nome.trim()).charAt(0);
      const letra =
        inicial && /[a-z]/.test(inicial)
          ? inicial.toLocaleUpperCase("pt-BR")
          : "#";
      const lista = agrupados.get(letra) ?? [];
      lista.push(cliente);
      agrupados.set(letra, lista);
    }
    return Array.from(agrupados.entries());
  }, [clientesFiltrados]);
  const agruparPorLetra = clientes.length > 20;

  function registrarFoco(trigger?: HTMLElement | null) {
    focoAnterior.current =
      trigger ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }

  function devolverFoco() {
    const elemento = focoAnterior.current;
    window.requestAnimationFrame(() => elemento?.focus());
  }

  function abrirDrawer(
    cliente: Cliente | null,
    trigger?: HTMLElement | null,
    nomeInicial = "",
  ) {
    registrarFoco(trigger);
    setDrawer({ cliente, nomeInicial });
  }

  function fecharDrawer() {
    setDrawer(null);
    devolverFoco();
  }

  function abrirConfirmacao(cliente: Cliente, trigger: HTMLElement) {
    registrarFoco(trigger);
    setClienteParaExcluir(cliente);
  }

  function fecharConfirmacao() {
    setClienteParaExcluir(null);
    devolverFoco();
  }

  function destacar(id: string) {
    setClienteDestacado(id);
    window.setTimeout(() => {
      setClienteDestacado((atual) => (atual === id ? null : atual));
    }, 2500);
  }

  async function salvarCliente(values: ClienteFormValues) {
    const payload: { nome: string; telefone?: string; email?: string } = {
      nome: values.nome,
    };
    const telefone = digitosTelefone(values.telefone);
    const email = values.email.trim();
    if (telefone) payload.telefone = telefone;
    if (email) payload.email = email;

    const cliente = drawer?.cliente;
    if (cliente) {
      const atualizado = (await authFetch(`/clientes/${cliente.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })) as Cliente;
      setClientes((atuais) =>
        atuais.map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
      destacar(atualizado.id);
      setToast(`Cliente ${atualizado.nome} atualizado`);
    } else {
      const criado = (await authFetch("/clientes", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as Cliente;
      setClientes((atuais) => [...atuais, criado]);
      destacar(criado.id);
      setToast(`Cliente ${criado.nome} cadastrado`);
    }
    fecharDrawer();
  }

  async function excluirCliente() {
    if (!clienteParaExcluir) return;
    await authFetch(`/clientes/${clienteParaExcluir.id}`, { method: "DELETE" });
    setClientes((atuais) =>
      atuais.filter((item) => item.id !== clienteParaExcluir.id),
    );
    setClienteParaExcluir(null);
    setToast("Cliente excluído");
  }

  const contagem = clientes.length === 1 ? "1 cliente" : `${clientes.length} clientes`;
  const mensagemBusca = buscaAplicada.trim();

  return (
    <div className="space-y-6 pb-24 md:space-y-8 md:pb-0">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-8">Clientes</h1>
          <p className="mt-1 text-base leading-6 text-zinc-700">{contagem}</p>
        </div>
        <button
          type="button"
          onClick={(event) => abrirDrawer(null, event.currentTarget)}
          className="hidden min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 md:flex"
        >
          <Plus aria-hidden="true" size={20} />
          Novo cliente
        </button>
      </header>

      <section aria-label="Lista de clientes" className="space-y-4">
        <BuscaClientes value={termo} onChange={setTermo} />

        {carregando ? (
          <div
            aria-label="Carregando clientes"
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
                  className="flex h-24 items-center gap-4 rounded-lg border border-zinc-200 p-4"
                >
                  <div className="size-11 animate-pulse rounded-full bg-zinc-100 motion-reduce:animate-none" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-100 motion-reduce:animate-none" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100 motion-reduce:animate-none" />
                  </div>
                </li>
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
              Não foi possível carregar os clientes. {erroCarga}
            </p>
            <button
              type="button"
              onClick={() => void carregar()}
              className="mt-4 min-h-11 rounded-md border border-zinc-300 bg-white px-4 py-2 text-base font-semibold text-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        ) : clientes.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 px-6 py-12 text-center">
            <Users
              aria-hidden="true"
              size={48}
              strokeWidth={1.5}
              className="mx-auto text-zinc-600"
            />
            <h2 className="mt-4 text-lg font-semibold leading-6">
              Você ainda não tem clientes cadastrados
            </h2>
            <p className="mt-2 text-base leading-6 text-zinc-700">
              Cadastre o primeiro para organizar seus atendimentos.
            </p>
            <button
              type="button"
              onClick={(event) => abrirDrawer(null, event.currentTarget)}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              <Plus aria-hidden="true" size={20} />
              Cadastrar primeiro cliente
            </button>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 px-6 py-10 text-center">
            <p className="text-base leading-6 text-zinc-800">
              Nenhum cliente encontrado para &apos;{mensagemBusca}&apos;
            </p>
            <button
              type="button"
              onClick={(event) =>
                abrirDrawer(null, event.currentTarget, mensagemBusca)
              }
              className="mt-4 min-h-11 rounded-md bg-zinc-950 px-4 py-2 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              Cadastrar &apos;{mensagemBusca}&apos;
            </button>
          </div>
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {clientesFiltrados.length} clientes encontrados
            </p>

            <div className="space-y-3 md:hidden">
              {grupos.map(([letra, grupo]) => (
                <section key={letra} aria-label={`Clientes com ${letra}`}>
                  {agruparPorLetra && (
                    <h2 className="sticky top-0 z-10 -mx-1 bg-zinc-50 px-1 py-2 text-base font-semibold leading-6 text-zinc-800">
                      {letra}
                    </h2>
                  )}
                  <ul className="space-y-3">
                    {grupo.map((cliente) => (
                      <li
                        key={cliente.id}
                        className={`relative rounded-lg border p-4 transition-colors motion-reduce:transition-none ${clienteDestacado === cliente.id ? "border-green-700 bg-green-50" : "border-zinc-200 bg-white"}`}
                      >
                        <button
                          type="button"
                          tabIndex={0}
                          onClick={(event) =>
                            abrirDrawer(cliente, event.currentTarget)
                          }
                          aria-label={`Editar cliente ${cliente.nome}`}
                          className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                        />
                        <div className="relative z-10 pointer-events-none flex items-start gap-3">
                          <ClienteAvatar nome={cliente.nome} />
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold leading-6 text-zinc-950">
                              <NomeDestacado
                                nome={cliente.nome}
                                termo={buscaAplicada}
                              />
                            </p>
                            <p className="text-base leading-6 text-zinc-800 tabular-nums">
                              {cliente.telefone
                                ? formatarTelefone(cliente.telefone)
                                : "Sem telefone"}
                            </p>
                            <p className="break-all text-sm leading-6 text-zinc-700">
                              {cliente.email || "Sem e-mail"}
                            </p>
                          </div>
                        </div>
                        <ClienteActions
                          cliente={cliente}
                          mobile
                          onEditar={(alvo, trigger) =>
                            abrirDrawer(alvo, trigger)
                          }
                          onExcluir={abrirConfirmacao}
                        />
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
                      Nome
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-base font-semibold leading-6"
                    >
                      Telefone
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-base font-semibold leading-6"
                    >
                      E-mail
                    </th>
                    <th
                      scope="col"
                      className="rounded-tr-lg px-4 py-3 text-right text-base font-semibold leading-6"
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                {grupos.map(([letra, grupo]) => (
                  <tbody key={letra}>
                    {agruparPorLetra && (
                      <tr>
                        <th
                          scope="rowgroup"
                          colSpan={4}
                          className="sticky top-12 z-[5] border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-left text-base font-semibold leading-6 text-zinc-800"
                        >
                          {letra}
                        </th>
                      </tr>
                    )}
                    {grupo.map((cliente) => (
                      <tr
                        key={cliente.id}
                        className={`border-b border-zinc-200 ${clienteDestacado === cliente.id ? "bg-green-50" : "bg-white"}`}
                      >
                        <td className="border-b border-zinc-200 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ClienteAvatar nome={cliente.nome} />
                            <span className="text-base font-semibold leading-6">
                              <NomeDestacado
                                nome={cliente.nome}
                                termo={buscaAplicada}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="border-b border-zinc-200 px-4 py-3 text-base leading-6 tabular-nums">
                          {cliente.telefone ? (
                            formatarTelefone(cliente.telefone)
                          ) : (
                            <span className="text-zinc-600">Sem telefone</span>
                          )}
                        </td>
                        <td className="border-b border-zinc-200 px-4 py-3 text-sm leading-6 text-zinc-800">
                          {cliente.email || "Sem e-mail"}
                        </td>
                        <td className="border-b border-zinc-200 px-4 py-2">
                          <ClienteActions
                            cliente={cliente}
                            onEditar={(alvo, trigger) =>
                              abrirDrawer(alvo, trigger)
                            }
                            onExcluir={abrirConfirmacao}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
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
          Novo cliente
        </button>
      </div>

      {drawer && (
        <ClienteDrawer
          key={`${drawer.cliente?.id ?? "novo"}-${drawer.nomeInicial}`}
          cliente={drawer.cliente}
          nomeInicial={drawer.nomeInicial}
          onClose={fecharDrawer}
          onSave={salvarCliente}
        />
      )}

      {clienteParaExcluir && (
        <ConfirmDialog
          title={`Excluir ${clienteParaExcluir.nome}?`}
          description="Essa ação não pode ser desfeita."
          confirmLabel="Excluir"
          loadingLabel="Excluindo…"
          onCancel={fecharConfirmacao}
          onConfirm={excluirCliente}
          getErrorMessage={(error) => {
            const mensagem =
              error instanceof Error
                ? error.message
                : "Não foi possível excluir o cliente.";
            return mensagem.includes(
              "Não é possível excluir: cliente possui agendamentos",
            )
              ? `${clienteParaExcluir.nome} tem agendamentos e não pode ser excluído agora.`
              : mensagem;
          }}
        />
      )}

      {toast && (
        <Toast message={toast} onDismiss={dispensarToast} />
      )}
    </div>
  );
}
