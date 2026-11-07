import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  telefone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
