import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { StatusAgendamento } from '@prisma/client';

export const FORMAS_PAGAMENTO = [
  'Pix',
  'Dinheiro',
  'Cartão de débito',
  'Cartão de crédito',
  'Outro',
] as const;

export class UpdateAgendamentoDto {
  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  clienteNome?: string;

  @IsOptional()
  @IsString()
  servicoId?: string;

  @IsOptional()
  @IsDateString()
  inicio?: string;

  @IsOptional()
  @IsString()
  observacao?: string;

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
