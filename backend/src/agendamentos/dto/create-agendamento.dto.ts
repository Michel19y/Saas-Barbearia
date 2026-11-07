import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAgendamentoDto {
  @IsString()
  clienteId!: string;

  @IsString()
  servicoId!: string;

  @IsDateString()
  inicio!: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
