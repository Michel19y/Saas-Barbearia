-- AlterTable
ALTER TABLE "atendimentos" ADD COLUMN     "profissionalNome" TEXT;

-- AlterTable
ALTER TABLE "clientes" ALTER COLUMN "telefone" DROP NOT NULL;
