import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { AtendimentosController } from './atendimentos.controller.js';
import type { AtendimentosService } from './atendimentos.service.js';

describe('AtendimentosController: só o dono corrige o histórico', () => {
  const service = { atualizarImportado: vi.fn(), excluirImportado: vi.fn() };
  const controller = new AtendimentosController(service as unknown as AtendimentosService);
  const usuario = (papel: string) => ({ sub: 'u1', barbeariaId: 'b1', papel, nome: 'X' }) as JwtPayload;

  beforeEach(() => vi.clearAllMocks());

  it.each(['PROFISSIONAL', 'RECEPCAO'])('%s não pode corrigir nem excluir', async (papel) => {
    expect(() => controller.atualizar(usuario(papel), 'a1', {})).toThrow(ForbiddenException);
    await expect(controller.excluir(usuario(papel), 'a1')).rejects.toThrow(ForbiddenException);
    expect(service.atualizarImportado).not.toHaveBeenCalled();
    expect(service.excluirImportado).not.toHaveBeenCalled();
  });

  it('o dono corrige e exclui, sempre na própria barbearia', async () => {
    await controller.atualizar(usuario('DONO'), 'a1', { valorCentavos: 0 });
    await controller.excluir(usuario('DONO'), 'a1');
    expect(service.atualizarImportado).toHaveBeenCalledWith('b1', 'a1', { valorCentavos: 0 });
    expect(service.excluirImportado).toHaveBeenCalledWith('b1', 'a1');
  });
});
