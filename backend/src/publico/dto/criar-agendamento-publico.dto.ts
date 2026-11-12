import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CriarAgendamentoPublicoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsString()
  @MinLength(8)
  telefone!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  servicoIds!: string[];

  @IsDateString()
  inicio!: string;

  // Opcional: sem ele, o sistema escolhe um profissional livre no horario
  @IsOptional()
  @IsString()
  profissionalId?: string;
}
