import { IsDateString, IsString, MinLength } from 'class-validator';

export class CriarAgendamentoPublicoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsString()
  @MinLength(8)
  telefone!: string;

  @IsString()
  servicoId!: string;

  @IsDateString()
  inicio!: string;
}
