import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MudancaHorarioDto } from './dto/mudanca-horario.dto.js';
import {
  type ConfigExpediente,
  type Excecao,
  type Mudanca,
  FORMATO_DATA,
  FORMATO_HORA,
  SEMANA_PADRAO,
  aplicarMudanca,
  cabeNoExpediente,
  diaDaSemana,
  minutos,
  noFuso,
  pausaValida,
  semanaValida,
} from './expediente.js';

/** Status que ainda vão acontecer (os que uma mudança de horário pode atingir). */
const STATUS_ATIVOS = ['PENDENTE', 'CONFIRMADO'] as const;

export type AgendamentoAfetado = {
  id: string;
  inicio: Date;
  fim: Date;
  clienteNome: string;
  telefone: string | null;
  servico: string;
  profissional: string;
};

@Injectable()
export class HorariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Configuração completa usada pela regra (semana da barbearia e dos profissionais + exceções). */
  async carregarConfig(barbeariaId: string): Promise<ConfigExpediente> {
    const ontem = noFuso(new Date(Date.now() - DIA_EM_MS)).data;
    const [barbearia, profissionais, excecoes] = await Promise.all([
      this.prisma.barbearia.findUnique({ where: { id: barbeariaId }, select: { horarioSemanal: true } }),
      this.prisma.usuario.findMany({ where: { barbeariaId }, select: { id: true, horarioSemanal: true } }),
      this.prisma.excecaoHorario.findMany({ where: { barbeariaId, data: { gte: ontem } } }),
    ]);
    return {
      barbearia: semanaValida(barbearia?.horarioSemanal),
      profissionais: Object.fromEntries(profissionais.map((p) => [p.id, semanaValida(p.horarioSemanal)])),
      excecoes: excecoes.map((e) => ({ ...e })),
    };
  }

  /** O que a tela de Horários mostra. */
  async obter(barbeariaId: string) {
    const hoje = noFuso(new Date()).data;
    const [config, profissionais, excecoes] = await Promise.all([
      this.carregarConfig(barbeariaId),
      this.prisma.usuario.findMany({
        // Só quem está ativo na Equipe; as regras de quem foi desativado ficam guardadas para se voltar
        where: { barbeariaId, ativo: true, papel: { in: ['DONO', 'PROFISSIONAL'] } },
        select: { id: true, nome: true, ativo: true },
        orderBy: { criadoEm: 'asc' },
      }),
      this.prisma.excecaoHorario.findMany({
        where: { barbeariaId, data: { gte: hoje } },
        include: { profissional: { select: { nome: true } } },
        orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }],
      }),
    ]);
    return {
      barbearia: { semana: config.barbearia ?? SEMANA_PADRAO, personalizada: config.barbearia !== null },
      profissionais: profissionais.map((p) => ({ ...p, semana: config.profissionais[p.id] ?? null })),
      excecoes: excecoes.map(({ profissional, ...e }) => ({ ...e, profissionalNome: profissional?.nome ?? null })),
    };
  }

  /** Quem seria cancelado pela mudança. Não grava nada. */
  async simular(barbeariaId: string, dto: MudancaHorarioDto) {
    const mudanca = await this.validar(barbeariaId, dto);
    const antes = await this.carregarConfig(barbeariaId);
    return { afetados: await this.afetados(barbeariaId, antes, aplicarMudanca(antes, mudanca)) };
  }

  /**
   * Grava a mudança. Se ela tirar agendamentos já marcados do expediente, só aplica com
   * `confirmarCancelamento`, e aí cancela esses agendamentos junto (tudo ou nada).
   */
  async aplicar(barbeariaId: string, dto: MudancaHorarioDto, confirmarCancelamento = false) {
    const mudanca = await this.validar(barbeariaId, dto);
    const antes = await this.carregarConfig(barbeariaId);
    const afetados = await this.afetados(barbeariaId, antes, aplicarMudanca(antes, mudanca));
    if (afetados.length > 0 && !confirmarCancelamento) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Essa mudança cancela agendamentos já marcados. Confirme para continuar.',
        afetados,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.gravar(tx, barbeariaId, mudanca);
      if (afetados.length > 0) {
        await tx.agendamento.updateMany({
          where: { id: { in: afetados.map((a) => a.id) }, barbeariaId },
          data: { status: 'CANCELADO' },
        });
      }
    });
    return { cancelados: afetados };
  }

  // ---------- internos ----------

  /** Agendamentos futuros que cabiam no expediente e deixam de caber (grupo de serviços vai junto). */
  private async afetados(
    barbeariaId: string,
    antes: ConfigExpediente,
    depois: ConfigExpediente,
  ): Promise<AgendamentoAfetado[]> {
    const futuros = await this.prisma.agendamento.findMany({
      where: { barbeariaId, status: { in: [...STATUS_ATIVOS] }, inicio: { gte: new Date() } },
      include: { cliente: true, servico: true, profissional: { select: { nome: true } } },
      orderBy: { inicio: 'asc' },
    });
    const saem = futuros.filter(
      (a) =>
        cabeNoExpediente(antes, a.profissionalId, a.inicio, a.fim) &&
        !cabeNoExpediente(depois, a.profissionalId, a.inicio, a.fim),
    );
    const ids = new Set(saem.map((a) => a.id));
    const grupos = new Set(saem.flatMap((a) => (a.grupoId ? [a.grupoId] : [])));
    return futuros
      .filter((a) => ids.has(a.id) || (a.grupoId !== null && grupos.has(a.grupoId)))
      .map((a) => ({
        id: a.id,
        inicio: a.inicio,
        fim: a.fim,
        clienteNome: a.clienteNome,
        telefone: a.cliente?.telefone ?? null,
        servico: a.servico.nome,
        profissional: a.profissional.nome,
      }));
  }

  private async validar(barbeariaId: string, dto: MudancaHorarioDto): Promise<Mudanca> {
    if (dto.tipo === 'remover-excecao') {
      const excecao = dto.excecaoId
        ? await this.prisma.excecaoHorario.findUnique({ where: { id: dto.excecaoId } })
        : null;
      if (excecao?.barbeariaId !== barbeariaId) throw new NotFoundException('Exceção não encontrada');
      return { tipo: 'remover-excecao', excecaoId: excecao.id };
    }

    const profissionalId = dto.profissionalId ?? null;
    if (profissionalId) {
      const profissional = await this.prisma.usuario.findUnique({ where: { id: profissionalId } });
      if (profissional?.barbeariaId !== barbeariaId) throw new NotFoundException('Profissional não encontrado');
    }

    if (dto.tipo === 'semana') {
      if (dto.semana === null || dto.semana === undefined) return { tipo: 'semana', profissionalId, semana: null };
      const semana = semanaValida(dto.semana);
      if (!semana) {
        throw new BadRequestException(
          'Horário da semana inválido: use HH:MM, o início antes do fim e a pausa dentro do expediente',
        );
      }
      return { tipo: 'semana', profissionalId, semana };
    }

    return { tipo: 'excecao', ...validarExcecao(dto, profissionalId) };
  }

  private async gravar(tx: Prisma.TransactionClient, barbeariaId: string, mudanca: Mudanca) {
    if (mudanca.tipo === 'remover-excecao') {
      await tx.excecaoHorario.delete({ where: { id: mudanca.excecaoId } });
      return;
    }
    if (mudanca.tipo === 'semana') {
      const horarioSemanal = mudanca.semana ?? Prisma.DbNull;
      if (mudanca.profissionalId === null) {
        await tx.barbearia.update({ where: { id: barbeariaId }, data: { horarioSemanal } });
      } else {
        await tx.usuario.update({ where: { id: mudanca.profissionalId }, data: { horarioSemanal } });
      }
      return;
    }
    const { tipo: _tipo, ...excecao } = mudanca;
    const existente = await tx.excecaoHorario.findFirst({
      where: { barbeariaId, profissionalId: excecao.profissionalId, data: excecao.data },
    });
    const dados = { ...excecao, barbeariaId };
    if (existente) {
      await tx.excecaoHorario.update({ where: { id: existente.id }, data: dados });
    } else {
      await tx.excecaoHorario.create({ data: dados });
    }
  }
}

const DIA_EM_MS = 86_400_000;

function validarExcecao(dto: MudancaHorarioDto, profissionalId: string | null): Omit<Excecao, 'id'> {
  const data = dto.data ?? '';
  if (!FORMATO_DATA.test(data) || Number.isNaN(diaDaSemana(data))) {
    throw new BadRequestException('Data inválida (use AAAA-MM-DD)');
  }
  if (data < noFuso(new Date()).data) throw new BadRequestException('Essa data já passou');
  const motivo = dto.motivo?.trim() || null;
  if (dto.fechado !== false) {
    return { profissionalId, data, fechado: true, inicio: null, fim: null, pausaInicio: null, pausaFim: null, motivo };
  }
  const inicio = dto.inicio ?? '';
  const fim = dto.fim ?? '';
  if (!FORMATO_HORA.test(inicio) || !FORMATO_HORA.test(fim) || minutos(inicio) >= minutos(fim)) {
    throw new BadRequestException('Horário inválido: use HH:MM e o início antes do fim');
  }
  const pausaInicio = dto.pausaInicio || null;
  const pausaFim = dto.pausaFim || null;
  if (!pausaValida(inicio, fim, pausaInicio, pausaFim)) {
    throw new BadRequestException('Pausa inválida: use HH:MM, o início antes do fim e dentro do expediente');
  }
  return { profissionalId, data, fechado: false, inicio, fim, pausaInicio, pausaFim, motivo };
}
