import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { GoogleService } from './google.service.js';

@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly googleService: GoogleService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('url')
  obterUrl(@CurrentUser() user: JwtPayload) {
    return { url: this.googleService.gerarUrlAutorizacao(user.sub) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@CurrentUser() user: JwtPayload) {
    return { conectado: await this.googleService.estaConectado(user.sub) };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    try {
      await this.googleService.tratarCallback(code, state);
      res.redirect(`${frontendUrl}/dashboard/importar?conectado=1`);
    } catch {
      res.redirect(`${frontendUrl}/dashboard/importar?erro=1`);
    }
  }
}
