import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { ImportacoesService } from './importacoes.service.js';
import { ImportarPlanilhaDto } from './dto/importar-planilha.dto.js';
import {
  extensaoAceita,
  MENSAGEM_FORMATO,
  TAMANHO_MAXIMO_BYTES,
} from './planilha-arquivo.js';

/** O que o multer entrega (memória, sem gravar em disco) e usamos aqui. */
type ArquivoEnviado = { buffer: Buffer; originalname: string };

/** Upload em memória, 1 arquivo, só planilhas, até o limite de tamanho. */
const RECEBER_ARQUIVO = FileInterceptor('arquivo', {
  limits: { fileSize: TAMANHO_MAXIMO_BYTES, files: 1 },
  fileFilter: (_req, file, aceitar) => {
    if (extensaoAceita(file.originalname)) return aceitar(null, true);
    aceitar(new BadRequestException(MENSAGEM_FORMATO), false);
  },
});

function exigirArquivo(arquivo?: ArquivoEnviado): { conteudo: Buffer; nome: string } {
  if (!arquivo) throw new BadRequestException('Escolha um arquivo para importar');
  return {
    conteudo: arquivo.buffer,
    // Navegadores mandam o nome em latin1; corrige acentos como "março.xlsx"
    nome: Buffer.from(arquivo.originalname, 'latin1').toString('utf8'),
  };
}

/**
 * Fluxo da tela: primeiro a prévia (lê e analisa, não grava nada), depois a importação
 * com o mesmo arquivo/link. As duas usam a mesma análise, então o resultado bate.
 */
@UseGuards(JwtAuthGuard)
@Controller('importacoes')
export class ImportacoesController {
  constructor(private readonly importacoesService: ImportacoesService) {}

  @Post('planilha/previa')
  previaPlanilha(@CurrentUser() user: JwtPayload, @Body() dto: ImportarPlanilhaDto) {
    return this.importacoesService.previaPlanilha(user.barbeariaId, user.sub, dto);
  }

  @Post('planilha')
  importar(@CurrentUser() user: JwtPayload, @Body() dto: ImportarPlanilhaDto) {
    return this.importacoesService.importarPlanilha(user.barbeariaId, user.sub, dto);
  }

  /** Prévia do arquivo enviado (campo multipart "arquivo"), sem gravar. */
  @Post('arquivo/previa')
  @UseInterceptors(RECEBER_ARQUIVO)
  previaArquivo(@CurrentUser() user: JwtPayload, @UploadedFile() arquivo?: ArquivoEnviado) {
    const { conteudo, nome } = exigirArquivo(arquivo);
    return this.importacoesService.previaArquivo(user.barbeariaId, conteudo, nome);
  }

  /** Envio direto do arquivo (campo multipart "arquivo"), sem conta Google. */
  @Post('arquivo')
  @UseInterceptors(RECEBER_ARQUIVO)
  importarArquivo(@CurrentUser() user: JwtPayload, @UploadedFile() arquivo?: ArquivoEnviado) {
    const { conteudo, nome } = exigirArquivo(arquivo);
    return this.importacoesService.importarArquivo(user.barbeariaId, conteudo, nome);
  }
}
