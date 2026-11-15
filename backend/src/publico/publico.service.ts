import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { barbeariaPorSlug } from '../common/slug-barbearia.js';
import { comTravaDeHorario } from '../common/trava-horario.js';
import { emSequencia } from '../common/sequencia-servicos.js';
import { HorariosService } from '../horarios/horarios.service.js';
import {
  FORMATO_DATA,
  cabeNaJanela,
  cabeNoExpediente,
  instante,
  janelaDoProfissional,
} from '../horarios/expediente.js';
import { CriarAgendamentoPublicoDto } from './dto/criar-agendamento-publico.dto.js';

const PASSO_MIN = 30;
/** Calendário da página pública: quantos dias mostrar e o teto de uma consulta. */
const DIAS_NO_CALENDARIO = 35;
const MAXIMO_DIAS_CONSULTA = 62;
/** "2026-12-10" tem 10 caracteres no começo do ISO. */
const DIGITOS_DATA_ISO = 10;
const MS_POR_MINUTO = 60_000;

// Quem atende cliente. A recepção entra no sistema, mas não é agendável.
const PAPEIS_AGENDAVEIS = ['DONO', 'PROFISSIONAL'] as const;

/** "2026-12-10", senão 404 (mesmo comportamento de antes para data inválida). */
function validarData(dataStr: string): string {
  if (!FORMATO_DATA.test(dataStr ?? '')) throw new NotFoundException('Data inválida');
  return dataStr;
}

@Injectable()
export class PublicoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly horarios: HorariosService,
  ) {}

  /** Aceita o link atual ou um link antigo da barbearia (links já divulgados continuam valendo). */
  private getBarbeariaPorSlug(slug: string) {
    return barbeariaPorSlug(this.prisma, slug);
  }

  /** Dados públicos mínimos; `slug` é sempre o atual, para a página trocar um link antigo pelo novo. */
  async dadosPublicos(slug: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    return { nome: barbearia.nome, slug: barbearia.slug };
  }

  private async getServicosOrdenados(barbeariaId: string, servicoIds: string[]) {
    if (servicoIds.length === 0) {
      throw new NotFoundException('Selecione pelo menos um serviço');
    }
    const servicos = await this.prisma.servico.findMany({
      where: { id: { in: servicoIds }, barbeariaId, ativo: true },
    });
    if (servicos.length !== new Set(servicoIds).size) {
      throw new NotFoundException('Um ou mais serviços não encontrados');
    }
    return servicoIds.map((id) => servicos.find((s) => s.id === id)!);
  }

  private getProfissionaisAgendaveis(barbeariaId: string) {
    return this.prisma.usuario.findMany({
      where: { barbeariaId, ativo: true, papel: { in: [...PAPEIS_AGENDAVEIS] } },
      select: { id: true, nome: true },
      orderBy: { criadoEm: 'asc' },
    });
  }

  async listarServicos(slug: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    return this.prisma.servico.findMany({
      where: { barbeariaId: barbearia.id, ativo: true },
      select: { id: true, nome: true, duracaoMin: true, precoCentavos: true },
      orderBy: { nome: 'asc' },
    });
  }

  async listarProfissionais(slug: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    return this.getProfissionaisAgendaveis(barbearia.id);
  }

  async horariosDisponiveis(
    slug: string,
    servicoIdsStr: string,
    dataStr: string,
    profissionalId?: string,
  ) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    const servicoIds = servicoIdsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const servicos = await this.getServicosOrdenados(barbearia.id, servicoIds);
    const duracaoTotal = servicos.reduce((soma, s) => soma + s.duracaoMin, 0);

    const data = validarData(dataStr);
    const candidatos = await this.candidatos(barbearia.id, profissionalId);
    const janelas = await this.janelasDoDia(barbearia.id, candidatos, data);
    if (janelas.length === 0) return [];

    // Grade de horários do primeiro que abre ao último que fecha; cada horário só entra
    // se algum profissional estiver de expediente e livre do início ao fim do atendimento.
    const inicioDia = Math.min(...janelas.map((j) => j.inicioMin));
    const fimDia = Math.max(...janelas.map((j) => j.fimMin));
    const agendamentosDoDia = await this.prisma.agendamento.findMany({
      where: {
        barbeariaId: barbearia.id,
        profissionalId: { in: janelas.map((j) => j.profissionalId) },
        status: { notIn: ['CANCELADO'] },
        inicio: { lt: instante(data, fimDia) },
        fim: { gt: instante(data, inicioDia) },
      },
      select: { inicio: true, fim: true, profissionalId: true },
    });

    const quantidade = Math.floor((fimDia - inicioDia) / PASSO_MIN) + 1;
    return Array.from({ length: quantidade }, (_, k) => inicioDia + k * PASSO_MIN)
      .filter((minuto) => instante(data, minuto).getTime() > Date.now())
      .filter((minuto) =>
        janelas.some(
          (j) =>
            // Dentro do expediente e sem encostar na pausa (ex.: almoço)
            cabeNaJanela(j, minuto, minuto + duracaoTotal) &&
            this.estaLivre(
              agendamentosDoDia,
              j.profissionalId,
              instante(data, minuto),
              instante(data, minuto + duracaoTotal),
            ),
        ),
      )
      .map((minuto) => instante(data, minuto).toISOString());
  }

  /** A barbearia (ou o profissional escolhido) atende nesse dia? Para a página mostrar "Fechado". */
  async expediente(slug: string, dataStr: string, profissionalId?: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    const data = validarData(dataStr);
    const candidatos = await this.candidatos(barbearia.id, profissionalId);
    const janelas = await this.janelasDoDia(barbearia.id, candidatos, data);
    return { aberto: janelas.length > 0 };
  }

  /**
   * Quais dias, a partir de `de`, a barbearia (ou o profissional escolhido) atende.
   * Para o calendário da página apagar os dias fechados sem uma chamada por dia.
   */
  async diasAbertos(slug: string, deStr: string, quantidadeStr?: string, profissionalId?: string) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    const de = validarData(deStr);
    const quantidade = Math.min(Math.max(Number(quantidadeStr) || DIAS_NO_CALENDARIO, 1), MAXIMO_DIAS_CONSULTA);
    const candidatos = await this.candidatos(barbearia.id, profissionalId);
    const config = await this.horarios.carregarConfig(barbearia.id);
    const [ano, mes, dia] = de.split('-').map(Number);
    const datas = Array.from({ length: quantidade }, (_, i) =>
      new Date(Date.UTC(ano, mes - 1, dia + i)).toISOString().slice(0, DIGITOS_DATA_ISO),
    );
    return {
      abertos: datas.filter((data) => candidatos.some((p) => janelaDoProfissional(config, p.id, data) !== null)),
    };
  }

  private async candidatos(barbeariaId: string, profissionalId?: string) {
    const profissionais = await this.getProfissionaisAgendaveis(barbeariaId);
    const candidatos = profissionalId
      ? profissionais.filter((p) => p.id === profissionalId)
      : profissionais;
    if (candidatos.length === 0) throw new NotFoundException('Profissional não encontrado');
    return candidatos;
  }

  /** Expediente de cada candidato na data; quem não trabalha no dia fica de fora. */
  private async janelasDoDia(barbeariaId: string, candidatos: { id: string }[], data: string) {
    const config = await this.horarios.carregarConfig(barbeariaId);
    return candidatos.flatMap((p) => {
      const janela = janelaDoProfissional(config, p.id, data);
      return janela ? [{ profissionalId: p.id, ...janela }] : [];
    });
  }

  async criarAgendamentoPublico(slug: string, dto: CriarAgendamentoPublicoDto) {
    const barbearia = await this.getBarbeariaPorSlug(slug);
    const servicos = await this.getServicosOrdenados(barbearia.id, dto.servicoIds);
    const duracaoTotal = servicos.reduce((soma, s) => soma + s.duracaoMin, 0);

    const profissionais = await this.getProfissionaisAgendaveis(barbearia.id);
    const candidatos = dto.profissionalId
      ? profissionais.filter((p) => p.id === dto.profissionalId)
      : profissionais;
    if (candidatos.length === 0) {
      throw new NotFoundException(
        dto.profissionalId
          ? 'Profissional não encontrado'
          : 'Barbearia sem profissional disponível',
      );
    }

    const inicio = new Date(dto.inicio);
    const fimTotal = new Date(inicio.getTime() + duracaoTotal * MS_POR_MINUTO);

    const ocupados = await this.prisma.agendamento.findMany({
      where: {
        barbeariaId: barbearia.id,
        profissionalId: { in: candidatos.map((p) => p.id) },
        status: { notIn: ['CANCELADO'] },
        inicio: { lt: fimTotal },
        fim: { gt: inicio },
      },
      select: { inicio: true, fim: true, profissionalId: true },
    });

    // Só aceita dentro do expediente (mesma regra que monta os horários oferecidos)
    const config = await this.horarios.carregarConfig(barbearia.id);
    const deExpediente = candidatos.filter((p) => cabeNoExpediente(config, p.id, inicio, fimTotal));
    if (deExpediente.length === 0) {
      throw new ConflictException('Esse horário está fora do expediente, escolha outro');
    }
    const escolhido = deExpediente.find((profissional) =>
      this.estaLivre(ocupados, profissional.id, inicio, fimTotal),
    );
    if (!escolhido) {
      throw new ConflictException('Esse horário acabou de ser ocupado, escolha outro');
    }

    // Mantém só os dígitos: "(11) 98888-7777" vira "11988887777"; espaços, parênteses e hífens saem.
    // https://regex101.com/?flavor=javascript&flags=g&regex=%5CD&testString=(11)%2098888-7777
    const telefone = dto.telefone.replace(/\D/g, '');
    let cliente = await this.prisma.cliente.findFirst({
      where: { barbeariaId: barbearia.id, telefone },
    });
    if (!cliente) {
      cliente = await this.prisma.cliente.create({
        data: { barbeariaId: barbearia.id, nome: dto.nome, telefone },
      });
    }

    const grupoId = servicos.length > 1 ? randomUUID() : null;
    const blocos = emSequencia(servicos, inicio);
    // Tudo ou nada; e se outro cliente pegou o horário no mesmo instante, a trava do banco recusa
    return comTravaDeHorario(() =>
      this.prisma.$transaction((tx) =>
        Promise.all(
          blocos.map((bloco) =>
            tx.agendamento.create({
              data: {
                barbeariaId: barbearia.id,
                clienteId: cliente.id,
                clienteNome: cliente.nome,
                profissionalId: escolhido.id,
                ...bloco,
                status: 'PENDENTE',
                grupoId,
              },
              include: { servico: true, profissional: { select: { nome: true } } },
            }),
          ),
        ),
      ),
    );
  }

  private estaLivre(
    agendamentos: { inicio: Date; fim: Date; profissionalId: string }[],
    profissionalId: string,
    inicio: Date,
    fim: Date,
  ) {
    return !agendamentos.some(
      (a) =>
        a.profissionalId === profissionalId && inicio < a.fim && fim > a.inicio,
    );
  }
}
