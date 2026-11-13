import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const PAPEIS_CRIAVEIS = ['PROFISSIONAL', 'RECEPCAO'] as const;

export class CreateProfissionalDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;

  @IsOptional()
  @IsIn(PAPEIS_CRIAVEIS)
  papel?: (typeof PAPEIS_CRIAVEIS)[number];
}
