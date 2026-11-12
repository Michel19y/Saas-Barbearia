export type Servico = {
  id: string;
  nome: string;
  duracaoMin: number;
  precoCentavos: number;
  ativo: boolean;
};

export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
};

export type StatusAgendamento =
  | "PENDENTE"
  | "CONFIRMADO"
  | "CONCLUIDO"
  | "CANCELADO"
  | "NAO_COMPARECEU";

export type Agendamento = {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  servicoId: string;
  inicio: string;
  fim: string;
  status: StatusAgendamento;
  observacao: string | null;
  cliente: Cliente | null;
  servico: Servico;
};

export type LinhaResumo = {
  rotulo: string;
  quantidade: number;
  totalCentavos: number;
};

export type ResumoFinanceiro = {
  periodo: { de: string | null; ate: string | null };
  totalCentavos: number;
  quantidade: number;
  ticketMedioCentavos: number;
  porFormaPagamento: LinhaResumo[];
  porServico: LinhaResumo[];
  porProfissional: LinhaResumo[];
};

export type Profissional = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
};
