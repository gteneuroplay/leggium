-- Designação da seção / período legislativo visível ao criar e listar sessões.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS secao_legislativa varchar(300) NULL;

COMMENT ON COLUMN sessoes.secao_legislativa IS 'Texto livre: ex. 1ª Sessão Ordinária 2026, Seção II';
