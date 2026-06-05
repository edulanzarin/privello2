-- Topic Audios — parte 2 de 2: usa o enum value criado no part1.
--
-- O Postgres exige que `TOPIC_AUDIO` (adicionado em
-- 20260726000000_topic_audios) tenha sido committed antes de poder
-- ser usado num WHERE/CHECK/predicate. Por isso esta parte fica
-- numa migration separada.

ALTER TABLE "medias"
    ADD COLUMN IF NOT EXISTS "topic_kind" "TopicAudioKind" NULL;

-- Unique parcial: 1 TOPIC_AUDIO ativo por (owner, topic_kind).
-- Filtra status=COMMITTED + role=TOPIC_AUDIO pra que substituições
-- (que marcam o anterior como DELETED) não quebrem o constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_medias_topic_unique"
    ON "medias" ("owner_id", "topic_kind")
    WHERE "role" = 'TOPIC_AUDIO'
        AND "status" = 'COMMITTED'
        AND "topic_kind" IS NOT NULL;
