-- Coluna que agrupa os serviços de um mesmo atendimento (ex.: corte + barba).
-- Ela já existia em produção, mas tinha sido criada direto no banco, sem migration; um banco
-- novo montado só pelas migrations ficava sem ela. IF NOT EXISTS: em produção não muda nada.

ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "grupoId" TEXT;

CREATE INDEX IF NOT EXISTS "agendamentos_grupoId_idx" ON "agendamentos"("grupoId");
