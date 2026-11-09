-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN_MASTER', 'ADMIN_CAMARA', 'SECRETARIA', 'JURIDICO', 'COMISSAO', 'VEREADOR', 'OPERADOR', 'DEV', 'ADMIN', 'PRESIDENTE');

-- CreateEnum
CREATE TYPE "ProposicaoTipoEnum" AS ENUM ('PROJETO_DE_LEI', 'PROJETO_DE_RESOLUCAO', 'DECRETO_LEGISLATIVO', 'MOCAO', 'REQUERIMENTO', 'INDICACAO', 'EMENDA', 'PORTARIA', 'ATA', 'PARECER_DE_COMISSAO');

-- CreateEnum
CREATE TYPE "ProposicaoStatus" AS ENUM ('RASCUNHO', 'PROTOCOLADO', 'EM_TRAMITACAO', 'AGUARDANDO_PARECER', 'PRONTO_PARA_PAUTA', 'EM_PAUTA', 'APROVADO', 'REJEITADO', 'ARQUIVADO', 'RETIRADO_PELO_AUTOR');

-- CreateEnum
CREATE TYPE "TramitacaoAcao" AS ENUM ('CRIADO', 'RECEBIDO', 'ENCAMINHADO', 'DEVOLVIDO', 'PARECER_FAVORAVEL', 'PARECER_CONTRARIO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "SessaoTipo" AS ENUM ('ORDINARIA', 'EXTRAORDINARIA', 'SOLENE', 'AUDIENCIA_PUBLICA');

-- CreateEnum
CREATE TYPE "SessaoStatus" AS ENUM ('AGENDADA', 'EM_CHAMADA', 'ABERTA', 'EM_VOTACAO', 'SUSPENSA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "VotoTipo" AS ENUM ('SIM', 'NAO', 'ABSTENCAO');

-- CreateEnum
CREATE TYPE "PresencaTipo" AS ENUM ('PRESENTE', 'AUSENTE', 'FALTA_JUSTIFICADA');

-- CreateTable
CREATE TABLE "proposicao_tipos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "sigla" VARCHAR(10) NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposicao_tipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome_camara" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "cidade" VARCHAR(100) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "brasao_url" TEXT,
    "gemini_api_key" TEXT,
    "status" BOOLEAN DEFAULT true,
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "permissoes" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "sigla" VARCHAR(20) NOT NULL,
    "permissoes" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha_hash" VARCHAR(255),
    "role" "UserRole" NOT NULL,
    "setor_id" UUID,
    "status" BOOLEAN DEFAULT true,
    "username" VARCHAR(50),
    "vereador_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bancadas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "sigla" VARCHAR(20) NOT NULL,
    "logo_url" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "bancadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vereadores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bancada_id" UUID NOT NULL,
    "nome_parlamentar" VARCHAR(100) NOT NULL,
    "foto_url" VARCHAR(255),
    "cargo_mesa" VARCHAR(50),
    "status_mandato" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "vereadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "sigla" VARCHAR(20) NOT NULL,
    "presidente_id" UUID NOT NULL,
    "relator_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "comissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissao_membros" (
    "comissao_id" UUID NOT NULL,
    "vereador_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comissao_membros_pkey" PRIMARY KEY ("comissao_id","vereador_id")
);

-- CreateTable
CREATE TABLE "visitantes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome_completo" VARCHAR(255) NOT NULL,
    "documento_cpf_rg" VARCHAR(50),
    "representacao" TEXT,
    "motivo_visita" TEXT NOT NULL,
    "foto_url" VARCHAR(500),
    "disponivel_tribuna" BOOLEAN NOT NULL DEFAULT false,
    "gabinete_destino_id" UUID,
    "data_entrada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_saida" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "visitantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_projetos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "tipo" "ProposicaoTipoEnum" NOT NULL,
    "conteudo_html" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "modelos_projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposicoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tipo" "ProposicaoTipoEnum" NOT NULL,
    "numero" INTEGER,
    "ano" INTEGER NOT NULL,
    "ementa" TEXT NOT NULL,
    "texto_completo" TEXT NOT NULL,
    "status" "ProposicaoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "autoria_mesa" BOOLEAN NOT NULL DEFAULT false,
    "autoria_poder_executivo" BOOLEAN NOT NULL DEFAULT false,
    "pdf_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "autor_id" UUID,

    CONSTRAINT "proposicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tramitacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "proposicao_id" UUID NOT NULL,
    "origem_setor_id" UUID,
    "destino_setor_id" UUID NOT NULL,
    "acao" "TramitacaoAcao" NOT NULL,
    "despacho_texto" TEXT,
    "usuario_id" UUID NOT NULL,
    "data_tramite" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tramitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pareceres" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "proposicao_id" UUID NOT NULL,
    "tipo_parecer" VARCHAR(50) NOT NULL,
    "comissao_id" UUID,
    "texto_parecer" TEXT NOT NULL,
    "conclusao" VARCHAR(20) NOT NULL,
    "autor_parecer_id" UUID NOT NULL,
    "arquivo_pdf_url" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "pareceres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "numero_sessao" INTEGER NOT NULL,
    "secao_legislativa" VARCHAR(300),
    "tipo" "SessaoTipo" NOT NULL,
    "data_sessao" TIMESTAMPTZ(6) NOT NULL,
    "status" "SessaoStatus" NOT NULL DEFAULT 'AGENDADA',
    "video_url_youtube" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordem_do_dia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "proposicao_id" UUID NOT NULL,
    "ordem_sequencial" INTEGER NOT NULL,
    "status_discussao" VARCHAR(50) NOT NULL DEFAULT 'AGUARDANDO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "ordem_do_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "vereador_id" UUID NOT NULL,
    "status" "PresencaTipo" NOT NULL,
    "timestamp_checkin" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presencas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "proposicao_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "resultado_calculado" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "votacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "votacao_id" UUID NOT NULL,
    "vereador_id" UUID NOT NULL,
    "voto" "VotoTipo" NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_palavra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "vereador_id" UUID,
    "visitante_id" UUID,
    "tipo" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_palavra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vereadores_user_id_key" ON "vereadores"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "presencas_sessao_id_vereador_id_key" ON "presencas"("sessao_id", "vereador_id");

-- CreateIndex
CREATE UNIQUE INDEX "votos_votacao_id_vereador_id_key" ON "votos"("votacao_id", "vereador_id");

-- AddForeignKey
ALTER TABLE "proposicao_tipos" ADD CONSTRAINT "proposicao_tipos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setores" ADD CONSTRAINT "setores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bancadas" ADD CONSTRAINT "bancadas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vereadores" ADD CONSTRAINT "vereadores_bancada_id_fkey" FOREIGN KEY ("bancada_id") REFERENCES "bancadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vereadores" ADD CONSTRAINT "vereadores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vereadores" ADD CONSTRAINT "vereadores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_presidente_id_fkey" FOREIGN KEY ("presidente_id") REFERENCES "vereadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_relator_id_fkey" FOREIGN KEY ("relator_id") REFERENCES "vereadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissao_membros" ADD CONSTRAINT "comissao_membros_comissao_id_fkey" FOREIGN KEY ("comissao_id") REFERENCES "comissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissao_membros" ADD CONSTRAINT "comissao_membros_vereador_id_fkey" FOREIGN KEY ("vereador_id") REFERENCES "vereadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitantes" ADD CONSTRAINT "visitantes_gabinete_destino_id_fkey" FOREIGN KEY ("gabinete_destino_id") REFERENCES "vereadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitantes" ADD CONSTRAINT "visitantes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_projetos" ADD CONSTRAINT "modelos_projetos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposicoes" ADD CONSTRAINT "proposicoes_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "vereadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposicoes" ADD CONSTRAINT "proposicoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_destino_setor_id_fkey" FOREIGN KEY ("destino_setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_origem_setor_id_fkey" FOREIGN KEY ("origem_setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_proposicao_id_fkey" FOREIGN KEY ("proposicao_id") REFERENCES "proposicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pareceres" ADD CONSTRAINT "pareceres_autor_parecer_id_fkey" FOREIGN KEY ("autor_parecer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pareceres" ADD CONSTRAINT "pareceres_comissao_id_fkey" FOREIGN KEY ("comissao_id") REFERENCES "comissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pareceres" ADD CONSTRAINT "pareceres_proposicao_id_fkey" FOREIGN KEY ("proposicao_id") REFERENCES "proposicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pareceres" ADD CONSTRAINT "pareceres_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_do_dia" ADD CONSTRAINT "ordem_do_dia_proposicao_id_fkey" FOREIGN KEY ("proposicao_id") REFERENCES "proposicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_do_dia" ADD CONSTRAINT "ordem_do_dia_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_do_dia" ADD CONSTRAINT "ordem_do_dia_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_vereador_id_fkey" FOREIGN KEY ("vereador_id") REFERENCES "vereadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votacoes" ADD CONSTRAINT "votacoes_proposicao_id_fkey" FOREIGN KEY ("proposicao_id") REFERENCES "proposicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votacoes" ADD CONSTRAINT "votacoes_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votacoes" ADD CONSTRAINT "votacoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votos" ADD CONSTRAINT "votos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votos" ADD CONSTRAINT "votos_vereador_id_fkey" FOREIGN KEY ("vereador_id") REFERENCES "vereadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votos" ADD CONSTRAINT "votos_votacao_id_fkey" FOREIGN KEY ("votacao_id") REFERENCES "votacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_palavra" ADD CONSTRAINT "solicitacoes_palavra_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_palavra" ADD CONSTRAINT "solicitacoes_palavra_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_palavra" ADD CONSTRAINT "solicitacoes_palavra_vereador_id_fkey" FOREIGN KEY ("vereador_id") REFERENCES "vereadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_palavra" ADD CONSTRAINT "solicitacoes_palavra_visitante_id_fkey" FOREIGN KEY ("visitante_id") REFERENCES "visitantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
