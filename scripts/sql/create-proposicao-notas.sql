CREATE TABLE IF NOT EXISTS proposicao_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposicao_id UUID NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proposicao_notas_proposicao
  ON proposicao_notas (proposicao_id, created_at DESC);

CREATE TABLE IF NOT EXISTS proposicao_notas_leitura (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposicao_id UUID NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, proposicao_id)
);
