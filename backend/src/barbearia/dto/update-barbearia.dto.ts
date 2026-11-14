import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SLUG_FORMATO, SLUG_MAX, SLUG_MIN } from '../../common/slug-barbearia.js';
import { slugify } from '../../common/slugify.js';

const NOME_MIN = 2;
const TEXTO_MAX = 100;
const TELEFONE_MAX = 20;

export class UpdateBarbeariaDto {
  /** Link de agendamento. "Barbearia Michel" é aceito e vira "barbearia-michel". */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? slugify(value) : value))
  @IsString()
  @MinLength(SLUG_MIN, { message: `O link precisa ter pelo menos ${SLUG_MIN} caracteres` })
  @MaxLength(SLUG_MAX, { message: `O link pode ter no máximo ${SLUG_MAX} caracteres` })
  @Matches(SLUG_FORMATO, { message: 'Use só letras, números e hífen no link' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(NOME_MIN)
  @MaxLength(TEXTO_MAX)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TELEFONE_MAX)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXTO_MAX)
  enderecoCidade?: string;
}
