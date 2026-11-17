import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from './jwt-payload.js';

const textoPreenchido = (valor: unknown): valor is string =>
  typeof valor === 'string' && valor.length > 0;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Só aceita token de sessão completo. Sem barbeariaId, os filtros `where: { barbeariaId }`
  // virariam `undefined` e o Prisma os ignoraria, devolvendo dados de todas as barbearias.
  validate(payload: Partial<JwtPayload> & { aud?: unknown }): JwtPayload {
    if (
      payload.aud !== undefined ||
      !textoPreenchido(payload.sub) ||
      !textoPreenchido(payload.barbeariaId) ||
      !textoPreenchido(payload.papel)
    ) {
      throw new UnauthorizedException();
    }
    return {
      sub: payload.sub,
      barbeariaId: payload.barbeariaId,
      papel: payload.papel,
      nome: payload.nome ?? '',
    };
  }
}
