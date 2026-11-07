import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateServicoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsInt()
  @Min(5)
  duracaoMin!: number;

  @IsInt()
  @Min(0)
  precoCentavos!: number;
}
