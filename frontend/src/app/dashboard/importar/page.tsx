"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";

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

  function verificarConexao() {
    authFetch("/auth/google/status")
      .then((data) => setConectado(data.conectado))
      .catch(() => setConectado(false));
  }

  useEffect(verificarConexao, []);

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
          Traga o histórico de atendimentos de uma planilha do Google Sheets. Cada
          aba é tratada como um dia (nome da aba = data), e cada bloco de colunas
          HORARIO/TIPO DO SERVIÇO/CLIENTE/ENTRADA/FP é um profissional.
        </p>
      </div>

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
