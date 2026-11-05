-- Oradores (visitantes): foto e flag para aparecer no painel do operador / fila da tribuna
ALTER TABLE visitantes
  ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS disponivel_tribuna BOOLEAN NOT NULL DEFAULT false;

-- Palavra na tribuna: vereador OU orador externo (visitante)
ALTER TABLE solicitacoes_palavra ADD COLUMN IF NOT EXISTS visitante_id UUID REFERENCES visitantes(id) ON DELETE CASCADE;

ALTER TABLE solicitacoes_palavra ALTER COLUMN vereador_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solicitacoes_palavra_quem_fala_chk'
  ) THEN
    ALTER TABLE solicitacoes_palavra ADD CONSTRAINT solicitacoes_palavra_quem_fala_chk CHECK (
      (vereador_id IS NOT NULL AND visitante_id IS NULL)
      OR (vereador_id IS NULL AND visitante_id IS NOT NULL)
    );
  END IF;
END $$;
