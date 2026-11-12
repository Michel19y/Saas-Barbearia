import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { StatusAgendamento } from '@prisma/client';
import { CreateAgendamentoDto } from './create-agendamento.dto.js';

export const FORMAS_PAGAMENTO = [
  'Pix',
  'Dinheiro',
  'Cartão de débito',
  'Cartão de crédito',
  'Outro',
] as const;

export class UpdateAgendamentoDto extends PartialType(CreateAgendamentoDto) {
  @IsOptional()
  @IsEnum(StatusAgendamento)
  status?: StatusAgendamento;

  @IsOptional()
  @IsIn(FORMAS_PAGAMENTO)
  formaPagamento?: (typeof FORMAS_PAGAMENTO)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  outroFormaPagamento?: string;
}
