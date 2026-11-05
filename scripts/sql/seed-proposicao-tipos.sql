WITH first_tenant AS (
  SELECT id
  FROM tenants
  ORDER BY created_at ASC
  LIMIT 1
),
tipos(sigla, nome, descricao) AS (
  VALUES
    ('PL', 'Projeto de Lei', 'Proposição legislativa para criação, alteração ou revogação de leis.'),
    ('PR', 'Projeto de Resolução', 'Norma interna da Câmara Municipal.'),
    ('PDL', 'Decreto Legislativo', 'Ato legislativo de competência exclusiva da Câmara.'),
    ('MOC', 'Moção', 'Manifestação política de aplauso, repúdio ou apoio.'),
    ('REQ', 'Requerimento', 'Solicitação formal de providências, informações ou medidas.'),
    ('IND', 'Indicação', 'Sugestão ao Poder Executivo para adoção de providências.'),
    ('ATA', 'Ata', 'Registro formal das deliberações e ocorrências de sessão ou reunião.'),
    ('PAREC', 'Parecer de Comissão', 'Manifestação técnica ou jurídica de comissão permanente ou especial sobre matéria em tramitação.'),
    ('EMD', 'Emenda', 'Alteração proposta em texto de proposição em tramitação.'),
    ('PORT', 'Portaria', 'Ato administrativo da estrutura da Câmara.')
),
existing AS (
  SELECT p.id, p.sigla
  FROM proposicao_tipos p
  JOIN first_tenant t ON t.id = p.tenant_id
)
UPDATE proposicao_tipos p
SET
  nome = tipos.nome,
  descricao = tipos.descricao
FROM tipos
JOIN existing e ON e.sigla = tipos.sigla
WHERE p.id = e.id;

WITH first_tenant AS (
  SELECT id
  FROM tenants
  ORDER BY created_at ASC
  LIMIT 1
),
tipos(sigla, nome, descricao) AS (
  VALUES
    ('PL', 'Projeto de Lei', 'Proposição legislativa para criação, alteração ou revogação de leis.'),
    ('PR', 'Projeto de Resolução', 'Norma interna da Câmara Municipal.'),
    ('PDL', 'Decreto Legislativo', 'Ato legislativo de competência exclusiva da Câmara.'),
    ('MOC', 'Moção', 'Manifestação política de aplauso, repúdio ou apoio.'),
    ('REQ', 'Requerimento', 'Solicitação formal de providências, informações ou medidas.'),
    ('IND', 'Indicação', 'Sugestão ao Poder Executivo para adoção de providências.'),
    ('ATA', 'Ata', 'Registro formal das deliberações e ocorrências de sessão ou reunião.'),
    ('PAREC', 'Parecer de Comissão', 'Manifestação técnica ou jurídica de comissão permanente ou especial sobre matéria em tramitação.'),
    ('EMD', 'Emenda', 'Alteração proposta em texto de proposição em tramitação.'),
    ('PORT', 'Portaria', 'Ato administrativo da estrutura da Câmara.')
)
INSERT INTO proposicao_tipos (id, tenant_id, nome, sigla, descricao, created_at)
SELECT gen_random_uuid(), t.id, tp.nome, tp.sigla, tp.descricao, now()
FROM tipos tp
CROSS JOIN first_tenant t
WHERE NOT EXISTS (
  SELECT 1
  FROM proposicao_tipos p
  WHERE p.tenant_id = t.id
    AND p.sigla = tp.sigla
);
