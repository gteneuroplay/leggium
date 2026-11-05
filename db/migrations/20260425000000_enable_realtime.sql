-- Publicação `supabase_realtime`: nome legado no Postgres (logical replication); não exige produto Supabase.
-- Tabela: solicitacoes_palavra
CREATE TABLE IF NOT EXISTS solicitacoes_palavra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    vereador_id UUID NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('DISCURSO', 'APARTE', 'QUESTAO_ORDEM')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ATENDIDO', 'CANCELADO', 'EM_FALA', 'RECUSADA')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para solicitacoes_palavra
ALTER TABLE solicitacoes_palavra ENABLE ROW LEVEL SECURITY;
CREATE POLICY solicitacoes_palavra_isolation_policy ON solicitacoes_palavra
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Habilitar Realtime para tabelas críticas do Painel Legislativo
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE sessoes;
ALTER PUBLICATION supabase_realtime ADD TABLE presencas;
ALTER PUBLICATION supabase_realtime ADD TABLE votacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE votos;
ALTER PUBLICATION supabase_realtime ADD TABLE solicitacoes_palavra;
ALTER PUBLICATION supabase_realtime ADD TABLE ordem_do_dia;
