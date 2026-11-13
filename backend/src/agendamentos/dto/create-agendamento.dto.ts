import {
  ArrayMinSize,
  IsArray,
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

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  servicoIds!: string[];

  @IsDateString()
  inicio!: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
