import { IsEmail, IsString, MinLength } from 'class-validator';
import { EmailNormalizado } from '../../common/email.js';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  nomeBarbearia!: string;

  @IsString()
  @MinLength(2)
  nomeDono!: string;

  @EmailNormalizado()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;
}
