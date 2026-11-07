import { IsString } from 'class-validator';

export class ImportarPlanilhaDto {
  @IsString()
  planilha!: string;
}
