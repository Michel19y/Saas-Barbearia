import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { EmailNormalizado } from '../../common/email.js';

const PAPEIS_CRIAVEIS = ['PROFISSIONAL', 'RECEPCAO'] as const;

export class CreateProfissionalDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @EmailNormalizado()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;

  @IsOptional()
  @IsIn(PAPEIS_CRIAVEIS)
  papel?: (typeof PAPEIS_CRIAVEIS)[number];
}
