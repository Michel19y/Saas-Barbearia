import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ImportacoesController } from './importacoes.controller.js';
import { ImportacoesService } from './importacoes.service.js';
import { TAMANHO_MAXIMO_BYTES } from './planilha-arquivo.js';

const STATUS_CRIADO = 201;
const STATUS_INVALIDO = 400;
const STATUS_GRANDE_DEMAIS = 413;
const UM_BYTE = 1;

describe('POST /importacoes/arquivo', () => {
  let app: INestApplication<App>;
  const service = {
    importarArquivo: vi.fn(),
    importarPlanilha: vi.fn(),
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ImportacoesController],
      providers: [{ provide: ImportacoesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
          ctx.switchToHttp().getRequest().user = { sub: 'u1', barbeariaId: 'b1', papel: 'DONO' };
          return true;
        },
      })
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service.importarArquivo.mockResolvedValue({ atendimentosCriados: 1 });
  });

  it('aceita a planilha e repassa conteúdo, nome e barbearia do usuário logado', async () => {
    await request(app.getHttpServer())
      .post('/importacoes/arquivo')
      .attach('arquivo', Buffer.from('conteudo'), 'agenda.xlsx')
      .expect(STATUS_CRIADO)
      .expect({ atendimentosCriados: 1 });

    const [barbeariaId, conteudo, nome] = service.importarArquivo.mock.calls[0];
    expect(barbeariaId).toBe('b1');
    expect(Buffer.isBuffer(conteudo)).toBe(true);
    expect(nome).toBe('agenda.xlsx');
  });

  it('mantém acentos no nome do arquivo', async () => {
    await request(app.getHttpServer())
      .post('/importacoes/arquivo')
      .attach('arquivo', Buffer.from('x'), { filename: 'março.csv' })
      .expect(STATUS_CRIADO);

    expect(service.importarArquivo.mock.calls[0][2]).toBe('março.csv');
  });

  it('recusa extensão que não é planilha', async () => {
    const res = await request(app.getHttpServer())
      .post('/importacoes/arquivo')
      .attach('arquivo', Buffer.from('x'), 'foto.png')
      .expect(STATUS_INVALIDO);

    expect(res.body.message).toContain('Formato não suportado');
    expect(service.importarArquivo).not.toHaveBeenCalled();
  });

  it('recusa envio sem arquivo', async () => {
    const res = await request(app.getHttpServer())
      .post('/importacoes/arquivo')
      .expect(STATUS_INVALIDO);

    expect(res.body.message).toBe('Escolha um arquivo para importar');
  });

  it('recusa arquivo acima do limite', async () => {
    await request(app.getHttpServer())
      .post('/importacoes/arquivo')
      .attach('arquivo', Buffer.alloc(TAMANHO_MAXIMO_BYTES + UM_BYTE), 'grande.xlsx')
      .expect(STATUS_GRANDE_DEMAIS);

    expect(service.importarArquivo).not.toHaveBeenCalled();
  });
});
