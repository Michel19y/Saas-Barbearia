import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const TEXTO_MAX = 100;
const FORMA_PAGAMENTO_MAX = 50;
/** Teto de sanidade por atendimento: R$ 100.000,00 (evita um zero a mais digitado sem querer). */
const VALOR_MAXIMO_CENTAVOS = 10_000_000;

/** Correção de um atendimento importado. Só os campos enviados mudam. */
export class UpdateAtendimentoDto {
  /** Data e hora com fuso, ex.: "2026-11-10T09:00:00-03:00". */
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Data e hora inválidas' })
  data?: string;

  /** Cliente cadastrado; `null` para um nome sem cadastro (vai em `clienteNome`). */
  @IsOptional()
  @IsString()
  clienteId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TEXTO_MAX)
  clienteNome?: string;

  @IsOptional()
  @IsString()
  servicoId?: string;

  /** Texto livre; vazio remove o profissional. */
  @IsOptional()
  @IsString()
  @MaxLength(TEXTO_MAX)
  profissionalNome?: string;

  @IsOptional()
  @IsInt({ message: 'Valor inválido' })
  @Min(0, { message: 'O valor não pode ser negativo' })
  @Max(VALOR_MAXIMO_CENTAVOS, { message: 'Valor alto demais; confira os zeros' })
  valorCentavos?: number;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Informe a forma de pagamento' })
  @MaxLength(FORMA_PAGAMENTO_MAX)
  formaPagamento?: string;
}
