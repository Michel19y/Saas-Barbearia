import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAgendamentoDto {
  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  clienteNome?: string;

  @IsString()
  servicoId!: string;

  @IsDateString()
  inicio!: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
