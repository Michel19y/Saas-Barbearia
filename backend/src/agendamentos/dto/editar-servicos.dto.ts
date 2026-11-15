import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const NOME_MIN = 2;
const NOME_MAX = 100;

/**
 * Edição do atendimento inteiro (todos os serviços marcados juntos para o cliente):
 * a lista de serviços substitui a atual, em sequência a partir de `inicio`.
 * Ex.: cliente marcou barba e na hora quer sobrancelha também.
 */
export class EditarServicosDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Escolha pelo menos um serviço' })
  @IsString({ each: true })
  servicoIds!: string[];

  /** Novo horário de início; sem ele, mantém o atual. */
  @IsOptional()
  @IsDateString()
  inicio?: string;

  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsString()
  @MinLength(NOME_MIN)
  @MaxLength(NOME_MAX)
  clienteNome?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
