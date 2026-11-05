-- Tipo de matéria «Parecer de Comissão» (enum + cadastro por tenant).

DO $$
BEGIN
  ALTER TYPE "ProposicaoTipoEnum" ADD VALUE 'PARECER_DE_COMISSAO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO proposicao_tipos (id, tenant_id, sigla, nome, descricao)
SELECT gen_random_uuid(), t.id, 'PAREC', 'Parecer de Comissão', 'Manifestação técnica ou jurídica de comissão permanente ou especial sobre matéria em tramitação.'
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM proposicao_tipos pt
    WHERE pt.tenant_id = t.id AND pt.sigla = 'PAREC'
  );
