import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GOOGLE_STATE_AUDIENCE, GOOGLE_STATE_EXPIRA_SEGUNDOS } from '../google/google.service.js';
import { JwtStrategy } from './jwt.strategy.js';

const SEGREDO = 'segredo-de-teste';

describe('JwtStrategy', () => {
  const config = { getOrThrow: () => SEGREDO } as unknown as ConfigService;
  const strategy = new JwtStrategy(config);

  const sessao = { sub: 'u1', barbeariaId: 'b1', papel: 'DONO', nome: 'Henrique' };

  it('aceita um token de sessão completo', () => {
    expect(strategy.validate(sessao)).toEqual(sessao);
  });

  it.each([
    ['sem barbeariaId', { sub: 'u1', papel: 'DONO' }],
    ['sem papel', { sub: 'u1', barbeariaId: 'b1' }],
    ['sem sub', { barbeariaId: 'b1', papel: 'DONO' }],
    ['barbeariaId vazio', { sub: 'u1', barbeariaId: '', papel: 'DONO' }],
    ['com audience (ex.: state do OAuth)', { ...sessao, aud: GOOGLE_STATE_AUDIENCE }],
  ])('recusa token %s', (_caso, payload) => {
    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });

  it('o state do Google não é verificável com a chave da sessão', () => {
    const jwtDoState = new JwtService({
      secret: `${SEGREDO}:${GOOGLE_STATE_AUDIENCE}`,
      signOptions: { audience: GOOGLE_STATE_AUDIENCE, expiresIn: GOOGLE_STATE_EXPIRA_SEGUNDOS },
    });
    const jwtDaSessao = new JwtService({ secret: SEGREDO });

    const state = jwtDoState.sign({ sub: 'u1' });

    expect(() => jwtDaSessao.verify(state)).toThrow();
  });
});
