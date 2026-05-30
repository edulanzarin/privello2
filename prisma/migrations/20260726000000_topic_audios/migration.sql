-- Topic Audios — áudios curtos respondendo perguntas comuns.
--
-- Recurso pra Acompanhante gravar respostas em áudio (≤30s) pra
-- perguntas frequentes: "Preço", "Atende casal?", "Disponibilidade"
-- etc. Aparecem como FAQ sonora no perfil público.
--
-- Reusa `Media` com novo role `TOPIC_AUDIO` + nova coluna
-- `topic_kind` enum. Cada User pode ter no máximo 1 áudio por
-- `topic_kind` (unique parcial) — gravar de novo substitui o
-- existente.

CREATE TYPE "TopicAudioKind" AS ENUM (
    'PRECO',
    'CASAL',
    'DISPONIBILIDADE',
    'LOCAL',
    'PRATICAS',
    'PAGAMENTO'
);

ALTER TYPE "MediaRole" ADD VALUE IF NOT EXISTS 'TOPIC_AUDIO';

ALTER TABLE "medias"
    ADD COLUMN "topic_kind" "TopicAudioKind" NULL;

-- Unique parcial: 1 TOPIC_AUDIO ativo por (owner, topic_kind).
-- Filtra status=COMMITTED + role=TOPIC_AUDIO pra que substituições
-- (que marcam o anterior como DELETED) não quebrem o constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_medias_topic_unique"
    ON "medias" ("owner_id", "topic_kind")
    WHERE "role" = 'TOPIC_AUDIO'
        AND "status" = 'COMMITTED'
        AND "topic_kind" IS NOT NULL;
