import { IsEmail, IsString, MinLength } from 'class-validator';
import { EmailNormalizado } from '../../common/email.js';

export class LoginDto {
  @EmailNormalizado()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;
}
