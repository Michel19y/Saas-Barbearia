import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StatusAgendamento } from '@prisma/client';
import { CreateAgendamentoDto } from './create-agendamento.dto.js';

export class UpdateAgendamentoDto extends PartialType(CreateAgendamentoDto) {
  @IsOptional()
  @IsEnum(StatusAgendamento)
  status?: StatusAgendamento;
}
