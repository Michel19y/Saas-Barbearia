import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  senhaAtual?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  novaSenha?: string;
}
