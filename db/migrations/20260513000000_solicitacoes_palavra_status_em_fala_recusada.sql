-- O painel usa status EM_FALA (palavra concedida) e RECUSADA (operador recusa o pedido).
-- A migração 20260425000000 restringia a PENDENTE | ATENDIDO | CANCELADO, o que quebrava UPDATEs e devolvia 500 nas server actions.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'solicitacoes_palavra'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%status%'
      AND pg_get_constraintdef(c.oid) LIKE '%PENDENTE%'
  LOOP
    EXECUTE format('ALTER TABLE solicitacoes_palavra DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE solicitacoes_palavra DROP CONSTRAINT IF EXISTS solicitacoes_palavra_status_check;

ALTER TABLE solicitacoes_palavra
  ADD CONSTRAINT solicitacoes_palavra_status_check
  CHECK (status IN ('PENDENTE', 'ATENDIDO', 'CANCELADO', 'EM_FALA', 'RECUSADA'));
