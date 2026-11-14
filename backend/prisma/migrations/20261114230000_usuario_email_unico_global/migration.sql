-- E-mail de usuário passa a ser único no sistema inteiro e sempre minúsculo.
-- Antes era único só dentro de cada barbearia, e o login (que busca só pelo e-mail)
-- podia entrar na barbearia errada quando o mesmo e-mail existia em duas.

UPDATE "usuarios" SET "email" = lower(trim("email"));

-- DropIndex
DROP INDEX "usuarios_barbeariaId_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_barbeariaId_idx" ON "usuarios"("barbeariaId");
