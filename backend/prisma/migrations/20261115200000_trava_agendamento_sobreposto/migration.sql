-- Trava no próprio banco: o mesmo profissional não pode ter dois agendamentos
-- (não cancelados) que se sobreponham no tempo. Fecha a corrida entre "conferir se está
-- livre" e "gravar" quando dois clientes confirmam o mesmo horário ao mesmo tempo.
--
-- Intervalo [inicio, fim): um atendimento que termina às 10:30 não colide com o que começa
-- às 10:30. Conferido no fim da transação (DEFERRABLE INITIALLY DEFERRED) para que reordenar
-- os serviços de um mesmo atendimento não esbarre na trava no meio do caminho.
--
-- O Prisma não descreve esse tipo de restrição no schema; ela vive só nesta migration.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "agendamentos"
  ADD CONSTRAINT "agendamentos_sem_sobreposicao"
  EXCLUDE USING gist ("profissionalId" WITH =, tsrange("inicio", "fim") WITH &&)
  WHERE ("status" <> 'CANCELADO')
  DEFERRABLE INITIALLY DEFERRED;
