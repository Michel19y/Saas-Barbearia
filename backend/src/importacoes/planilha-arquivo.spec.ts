import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { lerAbasDoArquivo } from './planilha-arquivo.js';
import { encontrarBlocosDeProfissional, parseDataAba } from './planilha-parser.js';

// 09:00 e 09:30 como o Excel guarda uma hora digitada: fração do dia com formato de hora
const HORAS_NO_DIA = 24;
const NOVE = 9;
const NOVE_E_MEIA_H = 9.5;
const NOVE_HORAS = NOVE / HORAS_NO_DIA;
const NOVE_E_MEIA = NOVE_E_MEIA_H / HORAS_NO_DIA;

const BYTES_DE_LIXO = 16;
const LIXO = 0xff;

const CABECALHO = ['HORARIO', 'TIPO DO SERVIÇO', 'CLIENTE', 'ENTRADA', 'FP'];

function planilhaComHoraReal(tipo: 'xlsx' | 'ods'): Buffer {
  const aba = XLSX.utils.aoa_to_sheet([
    ['Henrique'],
    CABECALHO,
    [NOVE_HORAS, 'Corte', 'João Silva', '45,00', 'P'],
    [NOVE_E_MEIA, 'Barba', 'Pedro Alves', 'R$ 30,00', 'D'],
    ['TOTAL'],
  ]);
  aba.A3.z = 'hh:mm';
  aba.A4.z = 'hh:mm';
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, aba, '10-11-2026');
  XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['sem data']]), 'Resumo');
  return XLSX.write(livro, { type: 'buffer', bookType: tipo }) as Buffer;
}

describe('lerAbasDoArquivo', () => {
  it.each(['xlsx', 'ods'] as const)(
    '%s: lê todas as abas e entrega a hora como texto "09:00"',
    (tipo) => {
      const abas = lerAbasDoArquivo(planilhaComHoraReal(tipo), `agenda.${tipo}`);

      expect(abas.map((a) => a.titulo)).toEqual(['10-11-2026', 'Resumo']);
      const [bloco] = encontrarBlocosDeProfissional(abas[0].linhas);
      expect(bloco.profissional).toBe('Henrique');
      expect(bloco.linhas).toEqual([
        { horario: '09:00', tipoServico: 'Corte', cliente: 'João Silva', entrada: '45,00', fp: 'P' },
        { horario: '09:30', tipoServico: 'Barba', cliente: 'Pedro Alves', entrada: 'R$ 30,00', fp: 'D' },
      ]);
    },
  );

  it('csv brasileiro (";" e vírgula decimal): usa o nome do arquivo como data e não converte valores', () => {
    const csv = [
      'Henrique;;;;',
      CABECALHO.join(';'),
      '09:00;Corte;João Silva;45,00;P',
      '10:30;Barba;Lucas Rocha;"R$ 1.234,50";C-D',
    ].join('\r\n');

    const [aba] = lerAbasDoArquivo(Buffer.from(`﻿${csv}`, 'utf8'), '10-11-2026.csv');

    expect(aba.titulo).toBe('10-11-2026');
    expect(parseDataAba(aba.titulo)).not.toBeNull();
    const [bloco] = encontrarBlocosDeProfissional(aba.linhas);
    expect(bloco.linhas.map((l) => [l.horario, l.cliente, l.entrada])).toEqual([
      ['09:00', 'João Silva', '45,00'],
      ['10:30', 'Lucas Rocha', 'R$ 1.234,50'],
    ]);
  });

  it('mantém linhas vazias para o cabeçalho continuar abaixo do nome do profissional', () => {
    const aba = XLSX.utils.aoa_to_sheet([[], ['Carlos'], CABECALHO, ['14:00', 'Corte', 'Davi', '35', 'D']]);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, aba, '11-11');
    const buffer = XLSX.write(livro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const [lida] = lerAbasDoArquivo(buffer, 'x.xlsx');
    expect(encontrarBlocosDeProfissional(lida.linhas)[0].profissional).toBe('Carlos');
  });

  it('recusa extensão não suportada', () => {
    expect(() => lerAbasDoArquivo(Buffer.from('x'), 'foto.png')).toThrow(BadRequestException);
  });

  it('recusa arquivo corrompido com mensagem amigável', () => {
    // Começa como um zip (PK) mas o resto é lixo
    const lixo = Buffer.concat([Buffer.from('PK', 'latin1'), Buffer.alloc(BYTES_DE_LIXO, LIXO)]);
    expect(() => lerAbasDoArquivo(lixo, 'quebrado.xlsx')).toThrow(
      'Não consegui ler esse arquivo',
    );
  });
});
