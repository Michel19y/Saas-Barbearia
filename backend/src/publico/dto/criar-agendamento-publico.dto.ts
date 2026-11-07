import { ArrayMinSize, IsArray, IsDateString, IsString, MinLength } from 'class-validator';

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
}
