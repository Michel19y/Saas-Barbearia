"use client";

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { formatarPreco } from "@/lib/formato";

type Campo = "hora" | "servico" | "cliente" | "valor" | "pagamento";

export type PreviaImportacao = {
  resumo: {
    atendimentos: number;
    valorTotalCentavos: number;
    dias: number;
    abasIgnoradas: number;
    clientesNovos: number;
    servicosNovos: number;
    problemas: number;
    /** Linhas que já estavam no histórico (de uma importação anterior) e vão ser puladas. */
    jaImportados?: number;
  };
  abas: Array<{
    titulo: string;
    data: string | null;
    importada: boolean;
    motivo?: string;
    avisos: string[];
    atendimentos: number;
    problemas: number;
    profissionais: Array<{ nome: string; atendimentos: number; colunas: Partial<Record<Campo, string>> }>;
  }>;
  problemas: Array<{ aba: string; linhaPlanilha: number; profissional: string; motivo: string }>;
  amostra: Array<{
    aba: string;
    profissional: string;
    cliente: string;
    servico: string;
    valorCentavos: number;
    formaPagamento: string;
    dataHora: string;
  }>;
};

const ROTULO_CAMPO: Record<Campo, string> = {
  hora: "Horário",
  cliente: "Cliente",
  servico: "Serviço",
  valor: "Valor",
  pagamento: "Pagamento",
};
const ORDEM_CAMPOS: Campo[] = ["hora", "cliente", "servico", "valor", "pagamento"];

/** "2026-11-10" vira "10/11/2026". */
function formatarDia(iso: string | null) {
  if (!iso) return "sem data";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDiaHora(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const CELULA = "border-b border-zinc-200 px-3 py-2 text-left align-top";

export default function PreviaImportacaoPainel({
  previa,
  importando,
  onConfirmar,
  onCancelar,
}: {
  previa: PreviaImportacao;
  importando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const { resumo } = previa;
  const nadaParaImportar = resumo.atendimentos === 0;

  return (
    <section
      aria-labelledby="previa-titulo"
      className="space-y-5 rounded-md border border-zinc-300 bg-white p-4"
    >
      <div>
        <h2 id="previa-titulo" className="text-base font-semibold">
          Prévia: confira antes de importar
        </h2>
        <p className="mt-1 text-sm text-zinc-600">Nada foi gravado ainda.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Atendimentos", String(resumo.atendimentos)],
          ["Dias", String(resumo.dias)],
          ["Valor total", formatarPreco(resumo.valorTotalCentavos)],
          ["Novos cadastros", `${plural(resumo.clientesNovos, "cliente", "clientes")} · ${plural(resumo.servicosNovos, "serviço", "serviços")}`],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-md bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-600">{rotulo}</dt>
            <dd className="text-base font-semibold tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>

      {(resumo.jaImportados ?? 0) > 0 && (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {plural(resumo.jaImportados ?? 0, "atendimento já tinha sido importado", "atendimentos já tinham sido importados")}{" "}
          antes e não vai entrar de novo. Pode mandar a mesma planilha sem medo de duplicar o Financeiro.
        </p>
      )}

      {resumo.problemas > 0 && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle aria-hidden="true" size={16} />
            {plural(resumo.problemas, "linha não será importada", "linhas não serão importadas")}. Corrija na
            planilha e envie de novo, ou importe assim mesmo sem elas.
          </p>
          <div className="max-h-64 overflow-auto rounded border border-amber-200 bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-50">
                <tr>
                  <th scope="col" className={CELULA}>Aba</th>
                  <th scope="col" className={CELULA}>Linha</th>
                  <th scope="col" className={CELULA}>Profissional</th>
                  <th scope="col" className={CELULA}>Problema</th>
                </tr>
              </thead>
              <tbody>
                {previa.problemas.map((p) => (
                  <tr key={`${p.aba}-${p.profissional}-${p.linhaPlanilha}`}>
                    <td className={CELULA}>{p.aba}</td>
                    <td className={`${CELULA} tabular-nums`}>{p.linhaPlanilha}</td>
                    <td className={CELULA}>{p.profissional}</td>
                    <td className={CELULA}>{p.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previa.problemas.length < resumo.problemas && (
            <p className="text-xs text-amber-900">
              Mostrando os primeiros {previa.problemas.length} de {resumo.problemas}.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Abas da planilha</h3>
        <ul className="space-y-2">
          {previa.abas.map((aba) => (
            <li key={aba.titulo} className="rounded-md border border-zinc-200 p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {aba.importada ? (
                  <CheckCircle2 aria-hidden="true" size={16} className="text-green-700" />
                ) : (
                  <XCircle aria-hidden="true" size={16} className="text-zinc-500" />
                )}
                <span>&quot;{aba.titulo}&quot;</span>
                <span className="font-normal text-zinc-600">
                  {aba.importada
                    ? `${formatarDia(aba.data)} · ${plural(aba.atendimentos, "atendimento", "atendimentos")}`
                    : `ignorada: ${aba.motivo}`}
                </span>
              </p>
              {aba.importada && (
                <ul className="mt-2 space-y-1 text-zinc-700">
                  {aba.profissionais.map((p) => (
                    <li key={p.nome}>
                      <span className="font-medium">{p.nome}</span>: {p.atendimentos} · colunas lidas:{" "}
                      {ORDEM_CAMPOS.filter((c) => p.colunas[c])
                        .map((c) => `${ROTULO_CAMPO[c]} = "${p.colunas[c]}"`)
                        .join(", ")}
                    </li>
                  ))}
                </ul>
              )}
              {aba.avisos.map((aviso) => (
                <p key={aviso} className="mt-1 text-amber-800">
                  {aviso}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </div>

      {previa.amostra.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            Como vai ficar ({plural(previa.amostra.length, "primeiro atendimento", "primeiros atendimentos")})
          </h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th scope="col" className={CELULA}>Dia e hora</th>
                  <th scope="col" className={CELULA}>Profissional</th>
                  <th scope="col" className={CELULA}>Cliente</th>
                  <th scope="col" className={CELULA}>Serviço</th>
                  <th scope="col" className={CELULA}>Valor</th>
                  <th scope="col" className={CELULA}>Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {previa.amostra.map((l) => (
                  <tr key={`${l.aba}-${l.profissional}-${l.dataHora}-${l.cliente}`}>
                    <td className={`${CELULA} whitespace-nowrap tabular-nums`}>{formatarDiaHora(l.dataHora)}</td>
                    <td className={CELULA}>{l.profissional}</td>
                    <td className={CELULA}>{l.cliente}</td>
                    <td className={CELULA}>{l.servico}</td>
                    <td className={`${CELULA} whitespace-nowrap tabular-nums`}>{formatarPreco(l.valorCentavos)}</td>
                    <td className={CELULA}>{l.formaPagamento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onConfirmar}
          disabled={importando || nadaParaImportar}
          className="flex min-h-11 items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importando && <Loader2 aria-hidden="true" size={16} className="animate-spin motion-reduce:animate-none" />}
          {nadaParaImportar
            ? "Nada para importar"
            : `Importar ${plural(resumo.atendimentos, "atendimento", "atendimentos")}`}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={importando}
          className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
