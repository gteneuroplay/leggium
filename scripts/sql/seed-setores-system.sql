WITH first_tenant AS (
  SELECT id
  FROM tenants
  ORDER BY created_at ASC
  LIMIT 1
),
defaults_setores(nome, sigla, permissoes) AS (
  VALUES
    (
      'Administrador',
      'ADM',
      '{"dashboard":true,"sessoes":true,"tramitacao":true,"pautas":true,"proposicoes":true,"painel":true,"painel_tv":true,"painel_operador":true,"painel_vereador":true,"bancadas":true,"vereadores":true,"comissoes":true,"visitantes":true,"setores":true,"cargos":true,"usuarios":true,"configuracoes":true}'::jsonb
    ),
    (
      'Jurídico',
      'JUR',
      '{"dashboard":false,"sessoes":false,"tramitacao":true,"pautas":false,"proposicoes":false,"painel":false,"painel_tv":false,"painel_operador":false,"painel_vereador":false,"bancadas":false,"vereadores":false,"comissoes":false,"visitantes":false,"setores":false,"cargos":false,"usuarios":false,"configuracoes":false}'::jsonb
    ),
    (
      'Operador',
      'OPE',
      '{"dashboard":false,"sessoes":false,"tramitacao":false,"pautas":false,"proposicoes":true,"painel":false,"painel_tv":false,"painel_operador":true,"painel_vereador":false,"bancadas":false,"vereadores":true,"comissoes":false,"visitantes":false,"setores":false,"cargos":false,"usuarios":false,"configuracoes":false}'::jsonb
    )
)
UPDATE setores s
SET
  sigla = d.sigla,
  permissoes = d.permissoes,
  updated_at = now(),
  deleted_at = null
FROM defaults_setores d
WHERE s.nome = d.nome
  AND EXISTS (
    SELECT 1
    FROM first_tenant t
    WHERE t.id = s.tenant_id
  );

WITH first_tenant AS (
  SELECT id
  FROM tenants
  ORDER BY created_at ASC
  LIMIT 1
),
defaults_setores(nome, sigla, permissoes) AS (
  VALUES
    (
      'Administrador',
      'ADM',
      '{"dashboard":true,"sessoes":true,"tramitacao":true,"pautas":true,"proposicoes":true,"painel":true,"painel_tv":true,"painel_operador":true,"painel_vereador":true,"bancadas":true,"vereadores":true,"comissoes":true,"visitantes":true,"setores":true,"cargos":true,"usuarios":true,"configuracoes":true}'::jsonb
    ),
    (
      'Jurídico',
      'JUR',
      '{"dashboard":false,"sessoes":false,"tramitacao":true,"pautas":false,"proposicoes":false,"painel":false,"painel_tv":false,"painel_operador":false,"painel_vereador":false,"bancadas":false,"vereadores":false,"comissoes":false,"visitantes":false,"setores":false,"cargos":false,"usuarios":false,"configuracoes":false}'::jsonb
    ),
    (
      'Operador',
      'OPE',
      '{"dashboard":false,"sessoes":false,"tramitacao":false,"pautas":false,"proposicoes":true,"painel":false,"painel_tv":false,"painel_operador":true,"painel_vereador":false,"bancadas":false,"vereadores":true,"comissoes":false,"visitantes":false,"setores":false,"cargos":false,"usuarios":false,"configuracoes":false}'::jsonb
    )
)
INSERT INTO setores (id, tenant_id, nome, sigla, permissoes, created_at)
SELECT gen_random_uuid(), t.id, d.nome, d.sigla, d.permissoes, now()
FROM defaults_setores d
CROSS JOIN first_tenant t
WHERE NOT EXISTS (
  SELECT 1
  FROM setores s
  WHERE s.tenant_id = t.id
    AND s.nome = d.nome
);
