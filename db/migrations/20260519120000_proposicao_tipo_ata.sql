-- Tipo de matéria «Ata» em proposições (enum + cadastro por tenant).

DO $$
BEGIN
  ALTER TYPE "ProposicaoTipoEnum" ADD VALUE 'ATA';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO proposicao_tipos (id, tenant_id, sigla, nome, descricao)
SELECT gen_random_uuid(), t.id, 'ATA', 'Ata', 'Registro formal das deliberações e ocorrências de sessão ou reunião.'
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM proposicao_tipos pt
    WHERE pt.tenant_id = t.id AND pt.sigla = 'ATA'
  );
