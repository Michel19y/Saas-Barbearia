import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClienteDto } from './dto/create-cliente.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  create(barbeariaId: string, dto: CreateClienteDto) {
    return this.prisma.cliente.create({ data: { ...dto, barbeariaId } });
  }

  findAll(barbeariaId: string) {
    return this.prisma.cliente.findMany({ where: { barbeariaId }, orderBy: { nome: 'asc' } });
  }

  async findOne(barbeariaId: string, id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    if (cliente.barbeariaId !== barbeariaId) throw new ForbiddenException();
    return cliente;
  }

  async update(barbeariaId: string, id: string, dto: UpdateClienteDto) {
    await this.findOne(barbeariaId, id);
    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  async remove(barbeariaId: string, id: string) {
    await this.findOne(barbeariaId, id);
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.agendamento.updateMany({
          where: { barbeariaId, clienteId: id },
          data: { clienteNome: 'Cliente excluído' },
        });
        await transaction.atendimento.updateMany({
          where: { barbeariaId, clienteId: id },
          data: { clienteNome: 'Cliente excluído' },
        });
        await transaction.cliente.delete({ where: { id } });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException('Não é possível excluir: cliente possui agendamentos');
      }
      throw err;
    }
  }
}
