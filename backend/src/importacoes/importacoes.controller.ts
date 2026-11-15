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

@UseGuards(JwtAuthGuard)
@Controller('importacoes')
export class ImportacoesController {
  constructor(private readonly importacoesService: ImportacoesService) {}

  @Post('planilha')
  importar(@CurrentUser() user: JwtPayload, @Body() dto: ImportarPlanilhaDto) {
    return this.importacoesService.importarPlanilha(user.barbeariaId, user.sub, dto);
  }

  /** Envio direto do arquivo (campo multipart "arquivo"), sem conta Google. */
  @Post('arquivo')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: TAMANHO_MAXIMO_BYTES, files: 1 },
      fileFilter: (_req, file, aceitar) => {
        if (extensaoAceita(file.originalname)) return aceitar(null, true);
        aceitar(new BadRequestException(MENSAGEM_FORMATO), false);
      },
    }),
  )
  importarArquivo(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() arquivo?: ArquivoEnviado,
  ) {
    if (!arquivo) throw new BadRequestException('Escolha um arquivo para importar');
    return this.importacoesService.importarArquivo(
      user.barbeariaId,
      arquivo.buffer,
      // Navegadores mandam o nome em latin1; corrige acentos como "março.xlsx"
      Buffer.from(arquivo.originalname, 'latin1').toString('utf8'),
    );
  }
}
