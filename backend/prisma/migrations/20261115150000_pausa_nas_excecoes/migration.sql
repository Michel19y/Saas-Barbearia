-- Pausa (ex.: almoço) num dia com horário especial. Só adiciona colunas vazias.

-- AlterTable
ALTER TABLE "excecoes_horario" ADD COLUMN     "pausaFim" TEXT,
ADD COLUMN     "pausaInicio" TEXT;

