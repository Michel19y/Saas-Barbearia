import { BadRequestException } from '@nestjs/common';
import { extname, basename } from 'node:path';
import * as XLSX from 'xlsx';

import type { Aba } from './planilha-parser.js';
export type { Aba };

export const EXTENSOES_ACEITAS = ['.xlsx', '.xls', '.ods', '.csv'] as const;
const BYTES_POR_KB = 1024;
const BYTES_POR_MB = BYTES_POR_KB * BYTES_POR_KB;
export const TAMANHO_MAXIMO_MB = 5;
export const TAMANHO_MAXIMO_BYTES = TAMANHO_MAXIMO_MB * BYTES_POR_MB;
/** Teto de linhas lidas por aba: protege a API de arquivos enormes (RNF05 fala em ~2.000). */
const MAX_LINHAS_POR_ABA = 5000;

export const MENSAGEM_FORMATO =
  'Formato não suportado. Envie uma planilha .xlsx, .xls, .ods ou .csv';
const MENSAGEM_ILEGIVEL =
  'Não consegui ler esse arquivo. Confira se é uma planilha válida e tente de novo.';

export function extensaoAceita(nomeArquivo: string): boolean {
  const ext = extname(nomeArquivo).toLowerCase();
  return (EXTENSOES_ACEITAS as readonly string[]).includes(ext);
}

/**
 * Texto da célula como aparece na planilha. Números com formato são refeitos a partir dele: alguns arquivos
 * (ex.: .ods) trazem a hora 09:00 como 0.375 no texto pronto, mas com o formato
 * "hh:mm" correto; formatando de novo, todos os tipos de arquivo dão "09:00".
 */
function textoDaCelula(celula: XLSX.CellObject | undefined): string {
  if (!celula) return '';
  if (celula.t === 'n' && celula.z) {
    try {
      return XLSX.SSF.format(celula.z, celula.v);
    } catch {
      // Formato que o SSF não entende: cai no texto pronto da célula
    }
  }
  return celula.w ?? XLSX.utils.format_cell(celula);
}

/** Linhas da aba como texto. Linhas vazias são mantidas (o cabeçalho depende da linha de cima). */
function linhasComoTexto(aba: XLSX.WorkSheet): string[][] {
  return Array.from(aba['!data'] ?? [], (linha) =>
    Array.from(linha ?? [], (celula) => textoDaCelula(celula)),
  );
}

/**
 * Lê todas as abas do arquivo como texto, exatamente como aparece na célula
 * (hora "09:00" continua "09:00"), no mesmo formato que o Google Sheets devolve.
 * CSV não tem abas: o nome do arquivo (sem extensão) faz o papel do nome da aba,
 * então "10-11-2026.csv" vira a aba do dia 10/11/2026.
 */
export function lerAbasDoArquivo(conteudo: Buffer, nomeArquivo: string): Aba[] {
  if (!extensaoAceita(nomeArquivo)) throw new BadRequestException(MENSAGEM_FORMATO);
  // O leitor "abre" um arquivo vazio como planilha em branco; melhor avisar
  if (conteudo.length === 0) throw new BadRequestException(MENSAGEM_ILEGIVEL);
  const ehCsv = extname(nomeArquivo).toLowerCase() === '.csv';

  let planilha: XLSX.WorkBook;
  try {
    planilha = XLSX.read(conteudo, {
      type: 'buffer',
      // CSV: não converte "45,00" ou "10/11" em número/data; mantém o texto
      raw: ehCsv,
      sheetRows: MAX_LINHAS_POR_ABA,
      dense: true,
    });
  } catch {
    throw new BadRequestException(MENSAGEM_ILEGIVEL);
  }

  if (planilha.SheetNames.length === 0) throw new BadRequestException(MENSAGEM_ILEGIVEL);

  return planilha.SheetNames.map((nomeAba) => ({
    titulo: ehCsv ? basename(nomeArquivo, extname(nomeArquivo)) : nomeAba,
    linhas: linhasComoTexto(planilha.Sheets[nomeAba]),
  }));
}
