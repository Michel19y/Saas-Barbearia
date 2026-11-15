import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleService } from '../google/google.service.js';
import { ImportarPlanilhaDto } from './dto/importar-planilha.dto.js';
import {
  encontrarBlocosDeProfissional,
  extrairSpreadsheetId,
  mapearFormaPagamento,
  parseDataAba,
  parseValorParaCentavos,
} from './planilha-parser.js';
import { type Aba, lerAbasDoArquivo } from './planilha-arquivo.js';

/** Duração dada aos serviços que a importação cria (a planilha não informa). */
const DURACAO_PADRAO_MIN = 30;

@Injectable()
export class ImportacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleService,
  ) {}

  /** Importa a partir de uma planilha do Google Sheets (precisa da conta Google conectada). */
  async importarPlanilha(barbeariaId: string, usuarioId: string, dto: ImportarPlanilhaDto) {
    const spreadsheetId = extrairSpreadsheetId(dto.planilha);
    const abas = await this.googleService.lerTodasAbas(usuarioId, spreadsheetId);
    return this.importarAbas(barbeariaId, abas);
  }

  /** Importa a partir de um arquivo enviado (.xlsx, .xls, .ods ou .csv); não usa o Google. */
  async importarArquivo(barbeariaId: string, conteudo: Buffer, nomeArquivo: string) {
    const abas = lerAbasDoArquivo(conteudo, nomeArquivo);
    return this.importarAbas(barbeariaId, abas);
  }

  /** Regra única de importação, igual para Google Sheets e arquivo. */
  private async importarAbas(barbeariaId: string, abas: Aba[]) {
    let clientesCriados = 0;
    let servicosCriados = 0;
    let atendimentosCriados = 0;
    const avisos: string[] = [];

    for (const aba of abas) {
      const data = parseDataAba(aba.titulo);
      if (!data) {
        avisos.push(`Aba "${aba.titulo}" ignorada: não consegui identificar a data pelo nome da aba`);
        continue;
      }

      const blocos = encontrarBlocosDeProfissional(aba.linhas);
      if (blocos.length === 0) {
        avisos.push(`Aba "${aba.titulo}": não encontrei nenhum bloco de profissional (coluna HORARIO)`);
        continue;
      }

      for (const bloco of blocos) {
        for (const linha of bloco.linhas) {
          const clienteNome = linha.cliente.trim();
          if (!clienteNome) continue;

          const servicoNome = linha.tipoServico.trim() || 'Serviço';
          const valorCentavos = parseValorParaCentavos(linha.entrada) ?? 0;
          const formaPagamento = mapearFormaPagamento(linha.fp);

          const [horaStr, minutoStr] = linha.horario.split(':');
          const dataHora = new Date(data);
          dataHora.setHours(Number(horaStr) || 0, Number(minutoStr) || 0, 0, 0);

          let cliente = await this.prisma.cliente.findFirst({
            where: { barbeariaId, nome: clienteNome },
          });
          if (!cliente) {
            cliente = await this.prisma.cliente.create({
              data: { barbeariaId, nome: clienteNome },
            });
            clientesCriados++;
          }

          let servico = await this.prisma.servico.findFirst({
            where: { barbeariaId, nome: servicoNome },
          });
          if (!servico) {
            servico = await this.prisma.servico.create({
              data: { barbeariaId, nome: servicoNome, duracaoMin: DURACAO_PADRAO_MIN, precoCentavos: valorCentavos },
            });
            servicosCriados++;
          }

          await this.prisma.atendimento.create({
            data: {
              barbeariaId,
              clienteId: cliente.id,
              clienteNome: cliente.nome,
              servicoId: servico.id,
              data: dataHora,
              formaPagamento,
              valorCentavos,
              profissionalNome: bloco.profissional,
            },
          });
          atendimentosCriados++;
        }
      }
    }

    return {
      clientesCriados,
      servicosCriados,
      atendimentosCriados,
      avisos,
    };
  }
}
