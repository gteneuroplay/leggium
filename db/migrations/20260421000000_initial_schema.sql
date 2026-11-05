-- Criando Enums
CREATE TYPE user_role AS ENUM (
    'ADMIN_MASTER',
    'ADMIN_CAMARA',
    'SECRETARIA',
    'JURIDICO',
    'COMISSAO',
    'VEREADOR',
    'OPERADOR'
);

CREATE TYPE proposicao_tipo AS ENUM (
    'PROJETO_DE_LEI',
    'PROJETO_DE_RESOLUCAO',
    'DECRETO_LEGISLATIVO',
    'MOCAO',
    'REQUERIMENTO',
    'INDICACAO',
    'EMENDA',
    'PORTARIA'
);

CREATE TYPE proposicao_status AS ENUM (
    'RASCUNHO',
    'PROTOCOLADO',
    'EM_TRAMITACAO',
    'AGUARDANDO_PARECER',
    'PRONTO_PARA_PAUTA',
    'EM_PAUTA',
    'APROVADO',
    'REJEITADO',
    'ARQUIVADO',
    'RETIRADO_PELO_AUTOR'
);

CREATE TYPE tramitacao_acao AS ENUM (
    'CRIADO',
    'RECEBIDO',
    'ENCAMINHADO',
    'DEVOLVIDO',
    'PARECER_FAVORAVEL',
    'PARECER_CONTRARIO',
    'ARQUIVADO'
);

CREATE TYPE sessao_tipo AS ENUM (
    'ORDINARIA',
    'EXTRAORDINARIA',
    'SOLENE',
    'AUDIENCIA_PUBLICA'
);

CREATE TYPE sessao_status AS ENUM (
    'AGENDADA',
    'EM_CHAMADA',
    'ABERTA',
    'EM_VOTACAO',
    'SUSPENSA',
    'ENCERRADA'
);

CREATE TYPE voto_tipo AS ENUM (
    'SIM',
    'NAO',
    'ABSTENCAO'
);

CREATE TYPE presenca_tipo AS ENUM (
    'PRESENTE',
    'AUSENTE',
    'FALTA_JUSTIFICADA'
);

-- Tabela: tenants
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_camara VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    uf CHAR(2) NOT NULL,
    brasao_url VARCHAR(255),
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: setores
CREATE TABLE setores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    sigla VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: users (legado: referência a auth.users; instalações só-VPS costumam usar id UUID sem FK a auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL,
    setor_id UUID REFERENCES setores(id) ON DELETE SET NULL,
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: bancadas
CREATE TABLE bancadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    sigla VARCHAR(20) NOT NULL,
    logo_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: vereadores
CREATE TABLE vereadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bancada_id UUID NOT NULL REFERENCES bancadas(id) ON DELETE RESTRICT,
    nome_parlamentar VARCHAR(100) NOT NULL,
    foto_url VARCHAR(255),
    status_mandato BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: comissoes
CREATE TABLE comissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    sigla VARCHAR(20) NOT NULL,
    presidente_id UUID NOT NULL REFERENCES vereadores(id) ON DELETE RESTRICT,
    relator_id UUID NOT NULL REFERENCES vereadores(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: comissao_membros
CREATE TABLE comissao_membros (
    comissao_id UUID NOT NULL REFERENCES comissoes(id) ON DELETE CASCADE,
    vereador_id UUID NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (comissao_id, vereador_id)
);

-- Tabela: visitantes
CREATE TABLE visitantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome_completo VARCHAR(255) NOT NULL,
    documento_cpf_rg VARCHAR(50) NOT NULL,
    motivo_visita TEXT NOT NULL,
    gabinete_destino_id UUID REFERENCES vereadores(id) ON DELETE SET NULL,
    data_entrada TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_saida TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: modelos_projetos
CREATE TABLE modelos_projetos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    tipo proposicao_tipo NOT NULL,
    conteudo_html TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: proposicoes
CREATE TABLE proposicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES vereadores(id) ON DELETE RESTRICT,
    tipo proposicao_tipo NOT NULL,
    numero INTEGER,
    ano INTEGER NOT NULL,
    ementa TEXT NOT NULL,
    texto_completo TEXT NOT NULL,
    status proposicao_status DEFAULT 'RASCUNHO' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: tramitacoes
CREATE TABLE tramitacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proposicao_id UUID NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
    origem_setor_id UUID REFERENCES setores(id) ON DELETE SET NULL,
    destino_setor_id UUID NOT NULL REFERENCES setores(id) ON DELETE RESTRICT,
    acao tramitacao_acao NOT NULL,
    despacho_texto TEXT,
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    data_tramite TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: pareceres
CREATE TABLE pareceres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proposicao_id UUID NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
    tipo_parecer VARCHAR(50) NOT NULL CHECK (tipo_parecer IN ('JURIDICO', 'COMISSAO')),
    comissao_id UUID REFERENCES comissoes(id) ON DELETE CASCADE,
    texto_parecer TEXT NOT NULL,
    conclusao VARCHAR(20) NOT NULL CHECK (conclusao IN ('FAVORAVEL', 'CONTRARIO')),
    autor_parecer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    arquivo_pdf_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: sessoes
CREATE TABLE sessoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    numero_sessao INTEGER NOT NULL,
    tipo sessao_tipo NOT NULL,
    data_sessao TIMESTAMP WITH TIME ZONE NOT NULL,
    status sessao_status NOT NULL DEFAULT 'AGENDADA',
    video_url_youtube VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: ordem_do_dia
CREATE TABLE ordem_do_dia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    proposicao_id UUID NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
    ordem_sequencial INTEGER NOT NULL,
    status_discussao VARCHAR(50) DEFAULT 'AGUARDANDO' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: presencas
CREATE TABLE presencas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    vereador_id UUID NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
    status presenca_tipo NOT NULL,
    timestamp_checkin TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(sessao_id, vereador_id)
);

-- Tabela: votacoes
CREATE TABLE votacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    proposicao_id UUID NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('ABERTA', 'ENCERRADA')),
    resultado_calculado VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela: votos
CREATE TABLE votos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    votacao_id UUID NOT NULL REFERENCES votacoes(id) ON DELETE CASCADE,
    vereador_id UUID NOT NULL REFERENCES vereadores(id) ON DELETE RESTRICT,
    voto voto_tipo NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(votacao_id, vereador_id)
);

-- Habilitando Realtime (Replicação) para as tabelas críticas da sessão
ALTER PUBLICATION supabase_realtime ADD TABLE sessoes, ordem_do_dia, presencas, votacoes, votos;

-- ====================================================================================================
-- RLS (Row Level Security) - Regras Multi-Tenant
-- ====================================================================================================
-- Enable RLS for all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bancadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vereadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissao_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tramitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pareceres ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordem_do_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE votacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE votos ENABLE ROW LEVEL SECURITY;

-- Helper function to get the current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id() RETURNS uuid AS $$
BEGIN
    RETURN (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo simplificado de RLS - Todas as tabelas filtradas por tenant_id (exceto tenants e o proprio usuario auth)
-- Tenants: qualquer um logado vê o seu próprio
CREATE POLICY tenant_isolation_policy ON tenants
    FOR ALL USING (id = public.get_auth_tenant_id());

-- Users: vê usuários do mesmo tenant
CREATE POLICY user_tenant_isolation_policy ON users
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Setores
CREATE POLICY setores_tenant_isolation_policy ON setores
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Bancadas
CREATE POLICY bancadas_tenant_isolation_policy ON bancadas
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Vereadores
CREATE POLICY vereadores_tenant_isolation_policy ON vereadores
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Comissoes
CREATE POLICY comissoes_tenant_isolation_policy ON comissoes
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Visitantes
CREATE POLICY visitantes_tenant_isolation_policy ON visitantes
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Modelos Projetos
CREATE POLICY modelos_projetos_tenant_isolation_policy ON modelos_projetos
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Proposicoes
CREATE POLICY proposicoes_tenant_isolation_policy ON proposicoes
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Tramitacoes
CREATE POLICY tramitacoes_tenant_isolation_policy ON tramitacoes
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Pareceres
CREATE POLICY pareceres_tenant_isolation_policy ON pareceres
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Sessoes
CREATE POLICY sessoes_tenant_isolation_policy ON sessoes
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Ordem do Dia
CREATE POLICY ordem_do_dia_tenant_isolation_policy ON ordem_do_dia
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Presencas
CREATE POLICY presencas_tenant_isolation_policy ON presencas
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Votacoes
CREATE POLICY votacoes_tenant_isolation_policy ON votacoes
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Votos (Voto é imutável! Somente insert ou select permitidos)
CREATE POLICY votos_tenant_isolation_policy_select ON votos
    FOR SELECT USING (tenant_id = public.get_auth_tenant_id());
CREATE POLICY votos_tenant_isolation_policy_insert ON votos
    FOR INSERT WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- Nota: Para simplificar no momento, todas as policies estão usando "FOR ALL". 
-- Políticas mais complexas (por Role) devem ser refinadas posteriormente.
