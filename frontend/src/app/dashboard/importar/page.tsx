"use client";

import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth";
import PreviaImportacaoPainel, { type PreviaImportacao } from "@/components/PreviaImportacao";

// Mesmo limite do backend (planilha-arquivo.ts)
const TAMANHO_MAXIMO_MB = 5;
const BYTES_POR_MB = 1_048_576;
const TAMANHO_MAXIMO_BYTES = TAMANHO_MAXIMO_MB * BYTES_POR_MB;
const EXTENSOES_ACEITAS = ".xlsx,.xls,.ods,.csv";

/** De onde vem a planilha: o mesmo arquivo/link é usado na prévia e na importação. */
type Origem = { tipo: "arquivo"; arquivo: File } | { tipo: "google"; planilha: string };

const ROTAS = {
  arquivo: { previa: "/importacoes/arquivo/previa", importar: "/importacoes/arquivo" },
  google: { previa: "/importacoes/planilha/previa", importar: "/importacoes/planilha" },
} as const;

function corpoDaRequisicao(origem: Origem): BodyInit {
  if (origem.tipo === "google") return JSON.stringify({ planilha: origem.planilha });
  const corpo = new FormData();
  corpo.append("arquivo", origem.arquivo);
  return corpo;
}

function enviar(origem: Origem, etapa: "previa" | "importar") {
  return authFetch(ROTAS[origem.tipo][etapa], { method: "POST", body: corpoDaRequisicao(origem) });
}

type ResultadoImportacao = {
  clientesCriados: number;
  servicosCriados: number;
  atendimentosCriados: number;
  avisos: string[];
};

export default function ImportarPage() {
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [planilha, setPlanilha] = useState("");
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const campoArquivo = useRef<HTMLInputElement>(null);

  async function verificarConexao() {
    try {
      const data = await authFetch("/auth/google/status");
      setConectado(data.conectado);
    } catch {
      setConectado(false);
    }
  }

  useEffect(() => {
    let ativo = true;
    async function carregarStatus() {
      try {
        const data = await authFetch("/auth/google/status");
        if (ativo) setConectado(data.conectado);
      } catch {
        if (ativo) setConectado(false);
      }
    }
    void carregarStatus();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("conectado") === "1") {
      verificarConexao();
    }
    if (params.get("erro") === "1") {
      setErro(
        "Não consegui conectar com o Google. Tente novamente — se persistir, revogue o acesso em myaccount.google.com/permissions e tente de novo.",
      );
    }
  }, []);

  async function handleConectar() {
    try {
      const data = await authFetch("/auth/google/url");
      window.location.href = data.url;
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao conectar com o Google");
    }
  }

  function limpar() {
    setPrevia(null);
    setOrigem(null);
    if (campoArquivo.current) campoArquivo.current.value = "";
  }

  /** Passo 1: lê e analisa a planilha, sem gravar nada. */
  async function gerarPrevia(nova: Origem) {
    setErro(null);
    setResultado(null);
    setPrevia(null);
    if (nova.tipo === "arquivo" && nova.arquivo.size > TAMANHO_MAXIMO_BYTES) {
      setErro(`O arquivo passa de ${TAMANHO_MAXIMO_MB} MB. Divida a planilha e envie em partes.`);
      limpar();
      return;
    }
    setCarregandoPrevia(true);
    try {
      setPrevia((await enviar(nova, "previa")) as PreviaImportacao);
      setOrigem(nova);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui ler a planilha");
      limpar();
    } finally {
      setCarregandoPrevia(false);
    }
  }

  /** Passo 2: grava o que a prévia mostrou (mesmo arquivo/link, mesma análise). */
  async function confirmarImportacao() {
    if (!origem) return;
    setErro(null);
    setImportando(true);
    try {
      setResultado((await enviar(origem, "importar")) as ResultadoImportacao);
      limpar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao importar planilha");
    } finally {
      setImportando(false);
    }
  }

  const ocupado = carregandoPrevia || importando;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Importar planilha</h1>
        <p className="text-sm text-zinc-500">
          Traga o histórico de atendimentos de uma planilha. Cada aba é um dia (a data
          fica no nome da aba, ex.: 10-11-2026 ou 10/11) e cada profissional tem seu
          bloco de colunas: horário, cliente, serviço, valor e forma de pagamento, em
          qualquer ordem. Antes de gravar, você vê uma prévia.
        </p>
      </div>

      <div className="space-y-3 rounded-md border border-zinc-200 p-4">
        <h2 className="text-base font-semibold">Enviar arquivo do computador</h2>
        <p className="text-sm text-zinc-500">
          Excel (.xlsx, .xls), LibreOffice (.ods) ou .csv, até {TAMANHO_MAXIMO_MB} MB.
          No .csv não há abas: use a data como nome do arquivo (ex.: 10-11-2026.csv).
        </p>
        <div className="space-y-1">
          <label htmlFor="importar-arquivo" className="text-xs text-zinc-500">
            Planilha
          </label>
          <input
            id="importar-arquivo"
            ref={campoArquivo}
            type="file"
            accept={EXTENSOES_ACEITAS}
            disabled={ocupado}
            onChange={(e) => {
              const escolhido = e.target.files?.[0];
              if (escolhido) void gerarPrevia({ tipo: "arquivo", arquivo: escolhido });
            }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-50 disabled:opacity-50"
          />
        </div>
      </div>

      <h2 className="text-base font-semibold">Ou importe do Google Sheets</h2>

      {conectado === false && (
        <div className="space-y-3 rounded-md border border-zinc-200 p-4">
          <p className="text-sm">
            Conecte sua conta Google pra eu poder ler a planilha.
          </p>
          <button
            onClick={handleConectar}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            Conectar com Google
          </button>
        </div>
      )}

      {conectado === true && (
        <div className="space-y-3 rounded-md border border-zinc-200 p-4">
          <p className="text-sm font-medium text-green-700">
            Conta Google conectada.
          </p>
          <div className="space-y-1">
            <label htmlFor="importar-link" className="text-xs text-zinc-500">
              Link ou ID da planilha
            </label>
            <input
              id="importar-link"
              value={planilha}
              onChange={(e) => setPlanilha(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => void gerarPrevia({ tipo: "google", planilha: planilha.trim() })}
            disabled={ocupado || !planilha.trim()}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            Ver prévia
          </button>
        </div>
      )}

      {carregandoPrevia && (
        <p role="status" className="text-sm text-zinc-600">
          Lendo a planilha…
        </p>
      )}

      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}

      {previa && (
        <PreviaImportacaoPainel
          previa={previa}
          importando={importando}
          onConfirmar={() => void confirmarImportacao()}
          onCancelar={limpar}
        />
      )}

      {resultado && (
        <div role="status" className="space-y-2 rounded-md border border-zinc-200 p-4 text-sm">
          <p className="font-medium">Importação concluída</p>
          <p className="text-zinc-500">
            {resultado.clientesCriados} clientes novos · {resultado.servicosCriados}{" "}
            serviços novos · {resultado.atendimentosCriados} atendimentos registrados
          </p>
          {resultado.avisos.length > 0 && (
            <div className="space-y-1">
              <p className="text-amber-600">Avisos:</p>
              <ul className="list-inside list-disc text-zinc-500">
                {resultado.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
