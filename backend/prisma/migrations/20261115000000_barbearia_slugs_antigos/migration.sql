-- Links de agendamento antigos: continuam funcionando e ficam reservados para a barbearia.

-- CreateTable
CREATE TABLE "barbearia_slugs_antigos" (
    "slug" TEXT NOT NULL,
    "barbeariaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barbearia_slugs_antigos_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "barbearia_slugs_antigos_barbeariaId_idx" ON "barbearia_slugs_antigos"("barbeariaId");

-- AddForeignKey
ALTER TABLE "barbearia_slugs_antigos" ADD CONSTRAINT "barbearia_slugs_antigos_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "barbearias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
