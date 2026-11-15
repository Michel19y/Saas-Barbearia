import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtendimentosService } from './atendimentos.service.js';

const DURACAO_MIN = 30;
const PRECO_ATUAL_CENTAVOS = 5000;
const VALOR_PAGO_CENTAVOS = 4500;

describe('AtendimentosService.historicoImportado', () => {
  let service: AtendimentosService;
  const prisma = { atendimento: { findMany: vi.fn() } };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtendimentosService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AtendimentosService);
  });

  it('busca só atendimentos da barbearia que não vieram de agendamento', async () => {
    prisma.atendimento.findMany.mockResolvedValue([]);

    await service.historicoImportado('barbearia-1');

    expect(prisma.atendimento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { barbeariaId: 'barbearia-1', agendamentoId: null } }),
    );
  });

  it('devolve no formato da agenda, concluído, com o valor pago e a origem na observação', async () => {
    prisma.atendimento.findMany.mockResolvedValue([
      {
        id: 'a1',
        clienteId: 'c1',
        clienteNome: 'João Silva',
        cliente: { id: 'c1', nome: 'João Silva' },
        servicoId: 's1',
        servico: { id: 's1', nome: 'Corte', duracaoMin: DURACAO_MIN, precoCentavos: PRECO_ATUAL_CENTAVOS },
        data: new Date('2026-11-10T12:00:00.000Z'),
        valorCentavos: VALOR_PAGO_CENTAVOS,
        formaPagamento: 'Pix',
        profissionalNome: 'Henrique',
      },
    ]);

    const [item] = await service.historicoImportado('barbearia-1');

    expect(item).toMatchObject({
      id: 'importado:a1',
      importado: true,
      status: 'CONCLUIDO',
      clienteNome: 'João Silva',
      servico: { nome: 'Corte', precoCentavos: VALOR_PAGO_CENTAVOS },
      grupoId: null,
      observacao: 'Importado da planilha · Profissional: Henrique · Pix',
    });
    expect(item.fim.toISOString()).toBe('2026-11-10T12:30:00.000Z');
  });

  it('omite o profissional quando a planilha não informou', async () => {
    prisma.atendimento.findMany.mockResolvedValue([
      {
        id: 'a2',
        clienteId: null,
        clienteNome: 'Bruno',
        cliente: null,
        servicoId: 's1',
        servico: { duracaoMin: DURACAO_MIN },
        data: new Date('2026-11-11T12:00:00.000Z'),
        valorCentavos: 0,
        formaPagamento: 'Não informado',
        profissionalNome: null,
      },
    ]);

    const [item] = await service.historicoImportado('barbearia-1');
    expect(item.observacao).toBe('Importado da planilha · Não informado');
  });
});

describe('AtendimentosService: correção do histórico importado', () => {
  let service: AtendimentosService;
  const importado = {
    id: 'a1',
    barbeariaId: 'b1',
    agendamentoId: null,
    clienteId: 'c1',
    clienteNome: 'João',
    servicoId: 's1',
    data: new Date('2026-11-10T12:00:00.000Z'),
    valorCentavos: VALOR_PAGO_CENTAVOS,
    formaPagamento: 'Pix',
    profissionalNome: 'Henrique',
  };
  const prisma = {
    atendimento: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    cliente: { findUnique: vi.fn() },
    servico: { findUnique: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.atendimento.findUnique.mockResolvedValue(importado);
    prisma.atendimento.update.mockImplementation(({ data }) =>
      Promise.resolve({
        ...importado,
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
        cliente: null,
        servico: { id: 's2', nome: 'Barba', duracaoMin: DURACAO_MIN, precoCentavos: PRECO_ATUAL_CENTAVOS },
      }),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtendimentosService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AtendimentosService);
  });

  it('corrige os campos e devolve o item no formato da agenda', async () => {
    prisma.servico.findUnique.mockResolvedValue({ id: 's2', barbeariaId: 'b1' });

    const item = await service.atualizarImportado('b1', 'a1', {
      data: '2026-11-10T10:30:00-03:00',
      clienteId: null,
      clienteNome: '  Pedro  ',
      servicoId: 's2',
      profissionalNome: '',
      valorCentavos: PRECO_ATUAL_CENTAVOS,
      formaPagamento: 'Dinheiro',
    });

    expect(prisma.atendimento.update.mock.calls[0][0].data).toEqual({
      clienteId: null,
      clienteNome: 'Pedro',
      servicoId: 's2',
      data: new Date('2026-11-10T13:30:00.000Z'),
      valorCentavos: PRECO_ATUAL_CENTAVOS,
      formaPagamento: 'Dinheiro',
      profissionalNome: null,
    });
    expect(item).toMatchObject({
      id: 'importado:a1',
      clienteNome: 'Pedro',
      servico: { nome: 'Barba', precoCentavos: PRECO_ATUAL_CENTAVOS },
      importacao: { atendimentoId: 'a1', formaPagamento: 'Dinheiro', profissionalNome: null },
    });
  });

  it('cliente cadastrado: usa o nome do cadastro', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c2', barbeariaId: 'b1', nome: 'Marcos Dias' });

    await service.atualizarImportado('b1', 'a1', { clienteId: 'c2' });

    expect(prisma.atendimento.update.mock.calls[0][0].data).toMatchObject({
      clienteId: 'c2',
      clienteNome: 'Marcos Dias',
    });
  });

  it('não aceita cliente nem serviço de outra barbearia', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'cx', barbeariaId: 'outra', nome: 'X' });
    await expect(service.atualizarImportado('b1', 'a1', { clienteId: 'cx' })).rejects.toThrow(
      'Cliente não encontrado',
    );

    prisma.servico.findUnique.mockResolvedValue({ id: 'sx', barbeariaId: 'outra' });
    await expect(service.atualizarImportado('b1', 'a1', { servicoId: 'sx' })).rejects.toThrow(
      'Serviço não encontrado',
    );
    expect(prisma.atendimento.update).not.toHaveBeenCalled();
  });

  it('sem cadastro exige um nome', async () => {
    await expect(
      service.atualizarImportado('b1', 'a1', { clienteId: null, clienteNome: '  ' }),
    ).rejects.toThrow('Informe o nome do cliente');
  });

  it('atendimento de outra barbearia não existe para quem pede', async () => {
    prisma.atendimento.findUnique.mockResolvedValue({ ...importado, barbeariaId: 'outra' });

    await expect(service.atualizarImportado('b1', 'a1', {})).rejects.toThrow('Atendimento não encontrado');
    await expect(service.excluirImportado('b1', 'a1')).rejects.toThrow('Atendimento não encontrado');
    expect(prisma.atendimento.delete).not.toHaveBeenCalled();
  });

  it('atendimento que veio de agendamento é corrigido pelo agendamento, não aqui', async () => {
    prisma.atendimento.findUnique.mockResolvedValue({ ...importado, agendamentoId: 'ag1' });

    await expect(service.excluirImportado('b1', 'a1')).rejects.toThrow('veio de um agendamento');
    expect(prisma.atendimento.delete).not.toHaveBeenCalled();
  });

  it('exclui o atendimento importado', async () => {
    await service.excluirImportado('b1', 'a1');
    expect(prisma.atendimento.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
