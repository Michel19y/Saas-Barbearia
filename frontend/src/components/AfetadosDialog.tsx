"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, MessageCircle, Phone } from "lucide-react";
import { type Afetado, dataHoraCurta, digitos, linkWhatsApp } from "@/lib/horarios";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Lista de clientes atingidos por uma mudança de horário, com WhatsApp e ligação.
 * - modo "confirmar": antes de aplicar ("você tem tal corte nesse dia, tem certeza?")
 * - modo "avisar": depois de aplicar, para ir chamando cada cliente e ninguém dar com a porta fechada
 */
export default function AfetadosDialog({
  modo,
  descricao,
  afetados,
  onConfirmar,
  onFechar,
}: {
  modo: "confirmar" | "avisar";
  descricao: string;
  afetados: Afetado[];
  onConfirmar?: () => Promise<void>;
  onFechar: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisados, setAvisados] = useState<string[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function confirmar() {
    if (!onConfirmar) return;
    setErro(null);
    setAplicando(true);
    try {
      await onConfirmar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aplicar a mudança.");
    } finally {
      setAplicando(false);
    }
  }

  const titulo =
    modo === "confirmar"
      ? `${plural(afetados.length, "agendamento será cancelado", "agendamentos serão cancelados")}`
      : "Avise os clientes";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="afetados-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (!aplicando) onFechar();
      }}
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40"
    >
      <div className="space-y-4 p-5">
        <header className="space-y-1">
          <h2 id="afetados-titulo" className="flex items-center gap-2 text-xl font-semibold">
            {modo === "confirmar" && <AlertTriangle aria-hidden="true" size={20} className="text-amber-600" />}
            {titulo}
          </h2>
          <p className="text-base leading-6 text-zinc-700">{descricao}</p>
          <p className="text-sm leading-6 text-zinc-600">
            {modo === "confirmar"
              ? "Esses clientes já tinham horário marcado. Se você confirmar, os agendamentos são cancelados. Use o WhatsApp para avisar e remarcar."
              : "Os agendamentos abaixo foram cancelados. Chame cada cliente para ninguém ir até a barbearia à toa."}
          </p>
        </header>

        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
          {afetados.map((a) => {
            const tel = digitos(a.telefone);
            const avisado = avisados.includes(a.id);
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {a.clienteNome}
                    {avisado && <span className="ml-2 text-sm font-normal text-green-700">avisado</span>}
                  </p>
                  <p className="text-sm text-zinc-700">
                    {dataHoraCurta(a.inicio)} · {a.servico} · {a.profissional}
                  </p>
                  <p className="text-sm tabular-nums text-zinc-600">{a.telefone ?? "sem telefone"}</p>
                </div>
                {tel && (
                  <div className="flex items-center gap-2">
                    <a
                      href={linkWhatsApp(a)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setAvisados((atual) => [...atual, a.id])}
                      className="flex min-h-11 items-center gap-2 rounded-md bg-green-700 px-3 text-sm font-semibold text-white hover:bg-green-800"
                    >
                      <MessageCircle aria-hidden="true" size={18} />
                      WhatsApp
                    </a>
                    <a
                      href={`tel:${tel}`}
                      aria-label={`Ligar para ${a.clienteNome}`}
                      className="flex size-11 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50"
                    >
                      <Phone aria-hidden="true" size={18} />
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {erro && (
          <p role="alert" className="text-base text-red-700">
            {erro}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {modo === "confirmar" ? (
            <>
              <button
                type="button"
                onClick={onFechar}
                disabled={aplicando}
                className="min-h-11 rounded-md border border-zinc-300 px-4 text-base font-semibold hover:bg-zinc-50"
              >
                Voltar sem mudar
              </button>
              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={aplicando}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-base font-semibold text-white hover:bg-red-800 disabled:opacity-70"
              >
                {aplicando && <Loader2 aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" />}
                {aplicando ? "Aplicando…" : `Cancelar ${plural(afetados.length, "agendamento", "agendamentos")} e aplicar`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onFechar}
              className="min-h-11 rounded-md bg-amber-500 px-4 text-base font-semibold text-zinc-950 hover:bg-amber-400"
            >
              Concluído
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
