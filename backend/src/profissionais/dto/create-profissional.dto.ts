import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateProfissionalDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;
}
