-- Horários de funcionamento: semana da barbearia e de cada profissional (JSON, vazio = padrão)
-- e exceções por data (fechar o dia ou mudar o horário). Só adiciona; nada existente muda.

-- AlterTable
ALTER TABLE "barbearias" ADD COLUMN     "horarioSemanal" JSONB;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "horarioSemanal" JSONB;

-- CreateTable
CREATE TABLE "excecoes_horario" (
    "id" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "profissionalId" TEXT,
    "data" TEXT NOT NULL,
    "fechado" BOOLEAN NOT NULL,
    "inicio" TEXT,
    "fim" TEXT,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excecoes_horario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "excecoes_horario_barbeariaId_data_idx" ON "excecoes_horario"("barbeariaId", "data");

-- AddForeignKey
ALTER TABLE "excecoes_horario" ADD CONSTRAINT "excecoes_horario_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excecoes_horario" ADD CONSTRAINT "excecoes_horario_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

