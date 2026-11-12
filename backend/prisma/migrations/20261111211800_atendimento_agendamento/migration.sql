ALTER TABLE "atendimentos"
ADD COLUMN "agendamentoId" TEXT;

CREATE UNIQUE INDEX "atendimentos_agendamentoId_key"
ON "atendimentos"("agendamentoId");

ALTER TABLE "atendimentos"
ADD CONSTRAINT "atendimentos_agendamentoId_fkey"
FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
