import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const MOTIVO_MAX = 100;

/**
 * Uma mudança de expediente. O formato detalhado de cada tipo é validado no serviço
 * (horários "HH:MM", início antes do fim, data no futuro, profissional da barbearia).
 *
 * - semana: troca a semana da barbearia (profissionalId null) ou de um profissional;
 *   `semana: null` volta ao padrão (barbearia) ou a seguir a barbearia (profissional).
 * - excecao: fecha uma data ou muda o horário só nela.
 * - remover-excecao: desfaz uma exceção.
 */
export class MudancaHorarioDto {
  @IsIn(['semana', 'excecao', 'remover-excecao'])
  tipo!: 'semana' | 'excecao' | 'remover-excecao';

  @IsOptional()
  @IsString()
  profissionalId?: string | null;

  /** 7 dias, 0 = domingo: [{ aberto, inicio: "09:00", fim: "19:00" }, …] */
  @IsOptional()
  semana?: unknown;

  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsBoolean()
  fechado?: boolean;

  @IsOptional()
  @IsString()
  inicio?: string;

  @IsOptional()
  @IsString()
  fim?: string;

  /** Pausa do dia (ex.: almoço), só com horário especial. */
  @IsOptional()
  @IsString()
  pausaInicio?: string;

  @IsOptional()
  @IsString()
  pausaFim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MOTIVO_MAX)
  motivo?: string;

  @IsOptional()
  @IsString()
  excecaoId?: string;
}

export class AplicarMudancaDto extends MudancaHorarioDto {
  /** Obrigatório quando a mudança cancela agendamentos já marcados. */
  @IsOptional()
  @IsBoolean()
  confirmarCancelamento?: boolean;
}
