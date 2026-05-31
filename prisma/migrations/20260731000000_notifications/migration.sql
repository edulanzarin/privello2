-- Notificações in-site (V2).
--
-- Central de avisos do usuário (foco: Acompanhante). Tudo no
-- site — NUNCA por email. Eventos que disparam:
--   - NOVA_AVALIACAO       — alguém deixou uma avaliação.
--   - NOVO_FAVORITO        — um Cliente salvou o perfil.
--   - VERIFICACAO_APROVADA — admin aprovou a verificação.
--   - VERIFICACAO_REJEITADA— admin rejeitou (motivo no payload).
--   - BOOST_ATIVADO        — boost passou a valer (imediato/agendado).
--
-- # Modelagem
--
-- - `type` é um enum fechado pra UI escolher ícone/título sem
--   parsear texto. O detalhe variável (nome do autor, motivo da
--   rejeição, etc.) fica em `payload` JSONB.
-- - `lida_em` NULL = não lida. O sininho conta WHERE lida_em IS
--   NULL. Marcar como lida grava o timestamp.
-- - Cascade no `user_id`: deletar a conta limpa as notificações.
--
-- O índice composto (user_id, criado_em DESC) cobre tanto a
-- listagem ("minhas notificações", ordem desc) quanto a contagem
-- de não lidas (varredura estreitada por user_id).

CREATE TYPE "NotificationType" AS ENUM (
    'NOVA_AVALIACAO',
    'NOVO_FAVORITO',
    'VERIFICACAO_APROVADA',
    'VERIFICACAO_REJEITADA',
    'BOOST_ATIVADO'
);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "lida_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_notifications" PRIMARY KEY ("id"),
    CONSTRAINT "fk_notifications_user"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_notifications_user_criado"
    ON "notifications" ("user_id", "criado_em" DESC);
