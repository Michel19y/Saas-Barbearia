"use client";

import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth";

// Mesmo limite do backend (planilha-arquivo.ts)
const TAMANHO_MAXIMO_MB = 5;
const BYTES_POR_MB = 1_048_576;
const TAMANHO_MAXIMO_BYTES = TAMANHO_MAXIMO_MB * BYTES_POR_MB;
const EXTENSOES_ACEITAS = ".xlsx,.xls,.ods,.csv";

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
  const [arquivo, setArquivo] = useState<File | null>(null);
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

  async function handleImportarArquivo() {
    if (!arquivo) return;
    setErro(null);
    setResultado(null);
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      setErro(`O arquivo passa de ${TAMANHO_MAXIMO_MB} MB. Divida a planilha e envie em partes.`);
      return;
    }
    setImportando(true);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const data = await authFetch("/importacoes/arquivo", { method: "POST", body: corpo });
      setResultado(data);
      setArquivo(null);
      if (campoArquivo.current) campoArquivo.current.value = "";
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao importar o arquivo");
    } finally {
      setImportando(false);
    }
  }

  async function handleImportar() {
    setErro(null);
    setResultado(null);
    setImportando(true);
    try {
      const data = await authFetch("/importacoes/planilha", {
        method: "POST",
        body: JSON.stringify({ planilha }),
      });
      setResultado(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao importar planilha");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Importar planilha</h1>
        <p className="text-sm text-zinc-500">
          Traga o histórico de atendimentos de uma planilha. Cada aba é tratada
          como um dia (nome da aba = data, ex.: 10-11-2026), e cada bloco de
          colunas HORARIO/TIPO DO SERVIÇO/CLIENTE/ENTRADA/FP é um profissional.
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
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-50"
          />
        </div>
        <button
          onClick={handleImportarArquivo}
          disabled={importando || !arquivo}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {importando && arquivo ? "Importando..." : "Importar arquivo"}
        </button>
      </div>

      <h2 className="text-base font-semibold">Ou importe do Google Sheets</h2>

      {conectado === false && (
        <div className="space-y-3 rounded-md border border-zinc-200 p-4">
          <p className="text-sm">
            Conecte sua conta Google pra eu poder ler a planilha.
          </p>
          <button
            onClick={handleConectar}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
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
            <label className="text-xs text-zinc-500">
              Link ou ID da planilha
            </label>
            <input
              value={planilha}
              onChange={(e) => setPlanilha(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleImportar}
            disabled={importando || !planilha}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {importando ? "Importando..." : "Importar todas as abas"}
          </button>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {resultado && (
        <div className="space-y-2 rounded-md border border-zinc-200 p-4 text-sm">
          <p className="font-medium">Importação concluída</p>
          <p className="text-zinc-500">
            {resultado.clientesCriados} clientes novos · {resultado.servicosCriados}{" "}
            serviços novos · {resultado.atendimentosCriados} atendimentos registrados
          </p>
          {resultado.avisos.length > 0 && (
            <div className="space-y-1">
              <p className="text-amber-600">Avisos:</p>
              <ul className="list-inside list-disc text-zinc-500">
                {resultado.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
