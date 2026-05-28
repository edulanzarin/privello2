-- Verificação de identidade + Sistema de denúncias.
--
-- # Verificação
--
-- Acompanhante envia selfie + documento. Admin aprova/rejeita.
-- Quando aprovada, AcompanhanteProfile.verificada = true e o
-- badge "Verificada" aparece no perfil e nos cards.
--
-- Cada Acompanhante tem 0 ou 1 verificação. Reenvio sobrescreve
-- a anterior (idempotente — economiza acúmulo de pedidos
-- expirados/rejeitados).
--
-- # Denúncia
--
-- Qualquer Cliente/Acompanhante autenticado pode denunciar:
--   - Outro perfil (User)
--   - Uma mídia (Media)
--   - Um comentário (MediaComment)
--   - Uma avaliação (AcompanhanteReview)
--
-- Motivo é enum fechado pra triagem rápida pelo admin. Cada
-- denúncia é uma linha — múltiplas pessoas denunciando o mesmo
-- alvo geram múltiplas linhas, e o admin trata uma de cada vez.
--
-- # Admin
--
-- Acesso ao /admin é controlado por `users.is_admin = true`.
-- Sem RBAC complexo no MVP — admin é admin total. Quando
-- crescer, vira tabela `Role` separada.

-- ===================================================================
-- 1) Flag de admin no User
-- ===================================================================

ALTER TABLE "users"
    ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_users_is_admin"
    ON "users" ("is_admin")
    WHERE "is_admin" = true;

-- ===================================================================
-- 2) Mirror "verificada" em acompanhante_profiles
-- ===================================================================

ALTER TABLE "acompanhante_profiles"
    ADD COLUMN "verificada" BOOLEAN NOT NULL DEFAULT false;

-- ===================================================================
-- 3) Verificação de identidade
-- ===================================================================

CREATE TYPE "VerificationStatus" AS ENUM (
    'PENDENTE',
    'APROVADA',
    'REJEITADA'
);

CREATE TABLE "verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "selfie_storage_key" TEXT NOT NULL,
    "documento_storage_key" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDENTE',
    "motivo_rejeicao" VARCHAR(500),
    "submetida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisada_em" TIMESTAMP(3),
    "revisada_por_user_id" UUID,

    PRIMARY KEY ("id"),
    CONSTRAINT "verifications_user_fk" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "verifications_revisor_fk" FOREIGN KEY ("revisada_por_user_id")
        REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "uniq_verification_user" UNIQUE ("user_id")
);

CREATE INDEX "idx_verifications_status_pending"
    ON "verifications" ("submetida_em" DESC)
    WHERE "status" = 'PENDENTE';

-- ===================================================================
-- 4) Denúncias
-- ===================================================================

CREATE TYPE "ReportTargetType" AS ENUM (
    'USER',
    'MEDIA',
    'COMMENT',
    'REVIEW'
);

CREATE TYPE "ReportMotivo" AS ENUM (
    'CONTEUDO_FALSO',
    'MENOR_DE_IDADE',
    'ASSEDIO',
    'GOLPE',
    'SPAM',
    'OUTRO'
);

CREATE TYPE "ReportStatus" AS ENUM (
    'PENDENTE',
    'RESOLVIDA',
    'DESCARTADA'
);

CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_user_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "motivo" "ReportMotivo" NOT NULL,
    "descricao" VARCHAR(2000),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDENTE',
    "resolucao" VARCHAR(500),
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvida_em" TIMESTAMP(3),
    "resolvida_por_user_id" UUID,

    PRIMARY KEY ("id"),
    CONSTRAINT "reports_reporter_fk" FOREIGN KEY ("reporter_user_id")
        REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "reports_resolver_fk" FOREIGN KEY ("resolvida_por_user_id")
        REFERENCES "users"("id") ON DELETE SET NULL
);

-- Index pra fila do admin (denúncias pendentes mais antigas primeiro).
CREATE INDEX "idx_reports_pending_oldest"
    ON "reports" ("criada_em" ASC)
    WHERE "status" = 'PENDENTE';

-- Index pra ver histórico de denúncias de um alvo específico.
CREATE INDEX "idx_reports_target"
    ON "reports" ("target_type", "target_id", "criada_em" DESC);

-- Index pra deduplicar — um reporter pode denunciar o mesmo alvo
-- múltiplas vezes? Permitimos por padrão (motivos diferentes), mas
-- aceleramos lookups.
CREATE INDEX "idx_reports_reporter"
    ON "reports" ("reporter_user_id", "criada_em" DESC);
