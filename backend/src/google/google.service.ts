import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GoogleService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private criarOAuthClient() {
    return new google.auth.OAuth2(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    );
  }

  gerarUrlAutorizacao(usuarioId: string) {
    const client = this.criarOAuthClient();
    const state = this.jwtService.sign({ sub: usuarioId }, { expiresIn: 600 });
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      state,
    });
  }

  async tratarCallback(code: string, state: string): Promise<string> {
    const { sub: usuarioId } = this.jwtService.verify<{ sub: string }>(state);
    const client = this.criarOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error(
        'O Google não retornou permissão permanente. Revogue o acesso em myaccount.google.com/permissions e tente conectar de novo.',
      );
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { googleRefreshToken: tokens.refresh_token },
    });

    return usuarioId;
  }

  async estaConectado(usuarioId: string): Promise<boolean> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    return Boolean(usuario?.googleRefreshToken);
  }

  async desconectar(usuarioId: string) {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { googleRefreshToken: null },
    });
  }

  private async obterClienteAutenticado(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario?.googleRefreshToken) {
      throw new NotFoundException('Conta Google não conectada');
    }
    const client = this.criarOAuthClient();
    client.setCredentials({ refresh_token: usuario.googleRefreshToken });
    return client;
  }

  async lerTodasAbas(
    usuarioId: string,
    spreadsheetId: string,
  ): Promise<{ titulo: string; linhas: string[][] }[]> {
    const auth = await this.obterClienteAutenticado(usuarioId);
    const sheets = google.sheets({ version: 'v4', auth });

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const titulos = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t));

    if (titulos.length === 0) {
      throw new NotFoundException('Essa planilha não tem nenhuma aba');
    }

    const resposta = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: titulos.map((t) => `${t}!A:Z`),
    });

    return titulos.map((titulo, i) => ({
      titulo,
      linhas: (resposta.data.valueRanges?.[i]?.values as string[][]) ?? [],
    }));
  }
}
