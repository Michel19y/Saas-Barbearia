import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PapelUsuario } from '@prisma/client';

const PAPEIS = ['DONO', 'PROFISSIONAL', 'RECEPCAO'] as const satisfies readonly PapelUsuario[];

export class UpdateProfissionalDto {
  @IsOptional()
  @IsIn(PAPEIS)
  papel?: PapelUsuario;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
