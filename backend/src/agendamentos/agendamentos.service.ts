import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto.js';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto.js';
import { EditarServicosDto } from './dto/editar-servicos.dto.js';

const MS_POR_MINUTO = 60_000;

@Injectable()
export class AgendamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(barbeariaId: string, profissionalId: string, dto: CreateAgendamentoDto) {
    const [cliente, servicosEncontrados] = await Promise.all([
      dto.clienteId
        ? this.prisma.cliente.findUnique({ where: { id: dto.clienteId } })
        : Promise.resolve(null),
      this.prisma.servico.findMany({
        where: { id: { in: dto.servicoIds }, barbeariaId },
      }),
    ]);
    if (dto.clienteId && (!cliente || cliente.barbeariaId !== barbeariaId)) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (servicosEncontrados.length !== new Set(dto.servicoIds).size) {
      throw new NotFoundException('Um ou mais serviços não encontrados');
    }
    const servicos = dto.servicoIds.map(
      (id) => servicosEncontrados.find((s) => s.id === id)!,
    );
    const clienteNome = cliente?.nome ?? dto.clienteNome?.trim();
    if (!clienteNome) {
      throw new BadRequestException(
        'Selecione um cliente ou informe uma identificação para o atendimento',
      );
    }

    const inicio = new Date(dto.inicio);
    const duracaoTotal = servicos.reduce((soma, s) => soma + s.duracaoMin, 0);
    const fimTotal = new Date(inicio.getTime() + duracaoTotal * 60000);

    await this.verificarConflito(profissionalId, inicio, fimTotal);

    const grupoId = servicos.length > 1 ? randomUUID() : null;
    const criados = [];
    let cursor = inicio;
    for (const servico of servicos) {
      const fimServico = new Date(cursor.getTime() + servico.duracaoMin * 60000);
      const agendamento = await this.prisma.agendamento.create({
        data: {
          barbeariaId,
          clienteId: cliente?.id ?? null,
          clienteNome,
          servicoId: servico.id,
          profissionalId,
          inicio: cursor,
          fim: fimServico,
          observacao: dto.observacao,
          grupoId,
        },
        include: { cliente: true, servico: true },
      });
      criados.push(agendamento);
      cursor = fimServico;
    }

    return criados;
  }

  findAll(barbeariaId: string) {
    return this.prisma.agendamento.findMany({
      where: { barbeariaId },
      include: { cliente: true, servico: true },
      orderBy: { inicio: 'asc' },
    });
  }

  async findOne(barbeariaId: string, id: string) {
    const agendamento = await this.prisma.agendamento.findUnique({ where: { id } });
    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');
    if (agendamento.barbeariaId !== barbeariaId) throw new ForbiddenException();
    return agendamento;
  }

  async update(barbeariaId: string, id: string, dto: UpdateAgendamentoDto) {
    const existente = await this.prisma.agendamento.findUnique({
      where: { id },
      include: { atendimento: true },
    });
    if (!existente) throw new NotFoundException('Agendamento não encontrado');
    if (existente.barbeariaId !== barbeariaId) throw new ForbiddenException();

    const statusFinal = dto.status ?? existente.status;
    if (dto.formaPagamento && statusFinal !== 'CONCLUIDO') {
      throw new BadRequestException(
        'A forma de pagamento só pode ser informada ao concluir o atendimento',
      );
    }

    if (dto.outroFormaPagamento && dto.formaPagamento !== 'Outro') {
      throw new BadRequestException(
        'A descrição só pode ser informada para a forma de pagamento Outro',
      );
    }

    let formaPagamento: string | undefined = dto.formaPagamento;
    if (formaPagamento === 'Outro') {
      const descricao = dto.outroFormaPagamento?.trim();
      if (!descricao) {
        throw new BadRequestException(
          'Informe qual foi a forma de pagamento',
        );
      }
      formaPagamento = `Outro: ${descricao}`;
    } else if (dto.outroFormaPagamento) {
      throw new BadRequestException(
        'A descrição só pode ser informada para a forma de pagamento Outro',
      );
    }

    if (statusFinal === 'CONCLUIDO') {
      formaPagamento ??= existente.atendimento?.formaPagamento;
      if (!formaPagamento) {
        throw new BadRequestException(
          'Informe a forma de pagamento para concluir o atendimento',
        );
      }
    }

    const data: Record<string, unknown> = {
      servicoId: dto.servicoId,
      observacao: dto.observacao,
      status: dto.status,
    };

    if (dto.clienteId) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: dto.clienteId },
      });
      if (!cliente || cliente.barbeariaId !== barbeariaId) {
        throw new NotFoundException('Cliente não encontrado');
      }
      data.clienteId = cliente.id;
      data.clienteNome = cliente.nome;
    } else if (dto.clienteNome !== undefined) {
      const clienteNome = dto.clienteNome.trim();
      if (clienteNome.length < 2) {
        throw new BadRequestException(
          'Informe uma identificação com pelo menos 2 caracteres',
        );
      }
      data.clienteId = null;
      data.clienteNome = clienteNome;
    } else if (dto.clienteId === '') {
      throw new BadRequestException(
        'Selecione um cliente ou informe uma identificação para o atendimento',
      );
    }

    if (dto.inicio || dto.servicoId) {
      const servicoId = dto.servicoId ?? existente.servicoId;
      const servico = await this.prisma.servico.findUnique({ where: { id: servicoId } });
      if (!servico || servico.barbeariaId !== barbeariaId) {
        throw new NotFoundException('Serviço não encontrado');
      }
      const inicio = dto.inicio ? new Date(dto.inicio) : existente.inicio;
      const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);
      await this.verificarConflito(existente.profissionalId, inicio, fim, [id]);
      data.inicio = inicio;
      data.fim = fim;
    }

    return this.prisma.$transaction(async (transaction) => {
      const atualizado = await transaction.agendamento.update({
        where: { id },
        data,
        include: {
          cliente: true,
          servico: true,
          profissional: { select: { nome: true } },
        },
      });

      if (atualizado.status === 'CONCLUIDO' && formaPagamento) {
        const dadosAtendimento = {
          clienteId: atualizado.clienteId,
          clienteNome: atualizado.clienteNome,
          servicoId: atualizado.servicoId,
          data: atualizado.inicio,
          formaPagamento,
          valorCentavos: atualizado.servico.precoCentavos,
          profissionalNome: atualizado.profissional.nome,
        };
        await transaction.atendimento.upsert({
          where: { agendamentoId: atualizado.id },
          create: {
            ...dadosAtendimento,
            agendamentoId: atualizado.id,
            barbeariaId,
          },
          update: dadosAtendimento,
        });
      }

      return atualizado;
    });
  }

  async remove(barbeariaId: string, id: string) {
    await this.findOne(barbeariaId, id);
    return this.prisma.agendamento.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });
  }

  /**
   * Troca os serviços de um atendimento (todos os itens do mesmo grupo), mantendo cliente,
   * status e observação. Os serviços ficam em sequência a partir do início; itens que
   * sobram são apagados e os que faltam são criados. Ex.: marcou barba e na hora quer
   * barba + sobrancelha.
   */
  async editarServicos(barbeariaId: string, id: string, dto: EditarServicosDto) {
    const alvo = await this.prisma.agendamento.findUnique({ where: { id } });
    if (!alvo) throw new NotFoundException('Agendamento não encontrado');
    if (alvo.barbeariaId !== barbeariaId) throw new ForbiddenException();

    const grupo = alvo.grupoId
      ? await this.prisma.agendamento.findMany({
          where: { barbeariaId, grupoId: alvo.grupoId, status: { not: 'CANCELADO' } },
          orderBy: { inicio: 'asc' },
        })
      : [alvo];
    if (grupo.some((item) => item.status === 'CONCLUIDO')) {
      throw new BadRequestException(
        'Esse atendimento já foi concluído e está no Financeiro. Para mudar os serviços, volte o status antes.',
      );
    }

    const encontrados = await this.prisma.servico.findMany({
      where: { id: { in: dto.servicoIds }, barbeariaId },
    });
    if (encontrados.length !== new Set(dto.servicoIds).size) {
      throw new NotFoundException('Um ou mais serviços não encontrados');
    }
    const servicos = dto.servicoIds.map((servicoId) => encontrados.find((s) => s.id === servicoId)!);

    const cliente = await this.clienteDaEdicao(barbeariaId, dto);
    const primeiro = grupo[0];
    const inicio = dto.inicio ? new Date(dto.inicio) : primeiro.inicio;
    const duracaoTotal = servicos.reduce((soma, s) => soma + s.duracaoMin, 0);
    await this.verificarConflito(
      primeiro.profissionalId,
      inicio,
      new Date(inicio.getTime() + duracaoTotal * MS_POR_MINUTO),
      grupo.map((item) => item.id),
    );

    // Horário de cada serviço, um depois do outro
    const blocos = servicos.reduce<{ servicoId: string; inicio: Date; fim: Date }[]>((lista, servico) => {
      const comeco = lista.at(-1)?.fim ?? inicio;
      return [...lista, { servicoId: servico.id, inicio: comeco, fim: new Date(comeco.getTime() + servico.duracaoMin * MS_POR_MINUTO) }];
    }, []);
    const grupoId = blocos.length > 1 ? (alvo.grupoId ?? randomUUID()) : null;
    const comum = {
      ...cliente,
      grupoId,
      ...(dto.observacao !== undefined ? { observacao: dto.observacao.trim() || null } : {}),
    };

    const ids = await this.prisma.$transaction(async (tx) => {
      const sobrando = grupo.slice(blocos.length).map((item) => item.id);
      if (sobrando.length > 0) await tx.agendamento.deleteMany({ where: { id: { in: sobrando } } });
      const salvos = await Promise.all(
        blocos.map((bloco, i) =>
          grupo[i]
            ? tx.agendamento.update({ where: { id: grupo[i].id }, data: { ...bloco, ...comum } })
            : tx.agendamento.create({
                data: {
                  ...bloco,
                  barbeariaId,
                  profissionalId: primeiro.profissionalId,
                  status: primeiro.status,
                  clienteId: primeiro.clienteId,
                  clienteNome: primeiro.clienteNome,
                  observacao: primeiro.observacao,
                  ...comum,
                },
              }),
        ),
      );
      return salvos.map((item) => item.id);
    });

    return this.prisma.agendamento.findMany({
      where: { id: { in: ids } },
      include: { cliente: true, servico: true },
      orderBy: { inicio: 'asc' },
    });
  }

  /** Cliente informado na edição: cadastrado (usa o nome do cadastro) ou só um nome. */
  private async clienteDaEdicao(barbeariaId: string, dto: EditarServicosDto) {
    if (dto.clienteId) {
      const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
      if (cliente?.barbeariaId !== barbeariaId) throw new NotFoundException('Cliente não encontrado');
      return { clienteId: cliente.id, clienteNome: cliente.nome };
    }
    if (dto.clienteNome !== undefined) return { clienteId: null, clienteNome: dto.clienteNome.trim() };
    return {};
  }

  private async verificarConflito(
    profissionalId: string,
    inicio: Date,
    fim: Date,
    ignorarIds: string[] = [],
  ) {
    const conflito = await this.prisma.agendamento.findFirst({
      where: {
        id: ignorarIds.length > 0 ? { notIn: ignorarIds } : undefined,
        profissionalId,
        status: { notIn: ['CANCELADO'] },
        inicio: { lt: fim },
        fim: { gt: inicio },
      },
    });
    if (conflito) {
      throw new ConflictException('Já existe um agendamento nesse horário');
    }
  }
}
