ALTER TABLE "agendamentos"
ADD COLUMN "clienteNome" TEXT;

UPDATE "agendamentos" AS agendamento
SET "clienteNome" = cliente."nome"
FROM "clientes" AS cliente
WHERE agendamento."clienteId" = cliente."id";

ALTER TABLE "agendamentos"
ALTER COLUMN "clienteNome" SET NOT NULL,
ALTER COLUMN "clienteId" DROP NOT NULL;

ALTER TABLE "agendamentos"
DROP CONSTRAINT "agendamentos_clienteId_fkey",
ADD CONSTRAINT "agendamentos_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "atendimentos"
ADD COLUMN "clienteNome" TEXT;

UPDATE "atendimentos" AS atendimento
SET "clienteNome" = cliente."nome"
FROM "clientes" AS cliente
WHERE atendimento."clienteId" = cliente."id";

ALTER TABLE "atendimentos"
ALTER COLUMN "clienteNome" SET NOT NULL,
ALTER COLUMN "clienteId" DROP NOT NULL;

ALTER TABLE "atendimentos"
DROP CONSTRAINT "atendimentos_clienteId_fkey",
ADD CONSTRAINT "atendimentos_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
