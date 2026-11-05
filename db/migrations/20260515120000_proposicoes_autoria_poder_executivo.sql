-- Autoria institucional: Poder Executivo (ex.: mensagem / projeto do Prefeito).
ALTER TABLE proposicoes
  ADD COLUMN IF NOT EXISTS autoria_poder_executivo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN proposicoes.autoria_poder_executivo IS 'Matéria de autoria do Poder Executivo municipal (sem vereador proponente).';

-- Permite proposição sem vereador vinculado quando a autoria é só institucional.
ALTER TABLE proposicoes
  ALTER COLUMN autor_id DROP NOT NULL;
