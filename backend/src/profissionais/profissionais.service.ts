import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProfissionalDto } from './dto/create-profissional.dto.js';
import { UpdateProfissionalDto } from './dto/update-profissional.dto.js';

const CAMPOS = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
} as const;

@Injectable()
export class ProfissionaisService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(barbeariaId: string) {
    return this.prisma.usuario.findMany({
      where: { barbeariaId },
      select: CAMPOS,
      orderBy: { criadoEm: 'asc' },
    });
  }

  async create(barbeariaId: string, dto: CreateProfissionalDto) {
    const existente = await this.prisma.usuario.findFirst({
      where: { barbeariaId, email: dto.email },
    });
    if (existente) {
      throw new ConflictException('Já existe alguém com esse e-mail na equipe');
    }

    return this.prisma.usuario.create({
      data: {
        barbeariaId,
        nome: dto.nome,
        email: dto.email,
        senhaHash: await bcrypt.hash(dto.senha, 10),
        papel: dto.papel ?? 'PROFISSIONAL',
      },
      select: CAMPOS,
    });
  }

  async update(
    barbeariaId: string,
    solicitanteId: string,
    id: string,
    dto: UpdateProfissionalDto,
  ) {
    const alvo = await this.prisma.usuario.findUnique({ where: { id } });
    if (!alvo || alvo.barbeariaId !== barbeariaId) {
      throw new NotFoundException('Pessoa não encontrada na equipe');
    }

    if (id === solicitanteId) {
      if (dto.ativo === false) {
        throw new BadRequestException('Você não pode desativar a própria conta');
      }
      if (dto.papel && dto.papel !== 'DONO') {
        throw new BadRequestException('Você não pode rebaixar a própria conta');
      }
    }

    if (alvo.papel === 'DONO' && dto.papel && dto.papel !== 'DONO') {
      const outrosDonos = await this.prisma.usuario.count({
        where: { barbeariaId, papel: 'DONO', ativo: true, id: { not: id } },
      });
      if (outrosDonos === 0) {
        throw new BadRequestException(
          'A barbearia precisa ter pelo menos um dono ativo',
        );
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      select: CAMPOS,
    });
  }
}
