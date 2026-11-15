const MS_POR_MINUTO = 60_000;

export type BlocoDeServico = { servicoId: string; inicio: Date; fim: Date };

/** Horário de cada serviço, um logo depois do outro, a partir de `inicio` (corte 10:00–10:30, barba 10:30–11:00). */
export function emSequencia(servicos: { id: string; duracaoMin: number }[], inicio: Date): BlocoDeServico[] {
  return servicos.reduce<BlocoDeServico[]>((blocos, servico) => {
    const comeco = blocos.at(-1)?.fim ?? inicio;
    return [
      ...blocos,
      { servicoId: servico.id, inicio: comeco, fim: new Date(comeco.getTime() + servico.duracaoMin * MS_POR_MINUTO) },
    ];
  }, []);
}
