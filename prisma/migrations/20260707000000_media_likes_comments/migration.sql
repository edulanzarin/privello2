-- Migration: curtidas e comentários em mídias.
--
-- Cliente plano Fan pode curtir mídias (1 curtida por par
-- (media, user)) e comentar (N comentários, autor pode excluir os
-- próprios). Cliente Grátis e visitantes anônimos veem os contadores
-- mas não conseguem interagir.
--
-- Agregados (`likes_count`, `comments_count`) ficam materializados
-- em `medias` e são atualizados via triggers no banco para
-- consistência sem depender da camada de aplicação.

-- Curtidas
CREATE TABLE "media_likes" (
    "media_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_likes_pkey" PRIMARY KEY ("media_id", "user_id")
);

ALTER TABLE "media_likes"
ADD CONSTRAINT "media_likes_media_id_fkey"
FOREIGN KEY ("media_id") REFERENCES "medias"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "media_likes"
ADD CONSTRAINT "media_likes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "media_likes_user_id_created_at_idx"
ON "media_likes" ("user_id", "created_at" DESC);

-- Comentários
CREATE TABLE "media_comments" (
    "id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_comments_text_min" CHECK (char_length(trim("text")) > 0)
);

ALTER TABLE "media_comments"
ADD CONSTRAINT "media_comments_media_id_fkey"
FOREIGN KEY ("media_id") REFERENCES "medias"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "media_comments"
ADD CONSTRAINT "media_comments_author_user_id_fkey"
FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "media_comments_media_id_created_at_idx"
ON "media_comments" ("media_id", "created_at" DESC);

CREATE INDEX "media_comments_author_user_id_created_at_idx"
ON "media_comments" ("author_user_id", "created_at" DESC);

-- Agregados em `medias`
ALTER TABLE "medias"
ADD COLUMN "likes_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "comments_count" INTEGER NOT NULL DEFAULT 0;

-- Triggers
--
-- Como esperamos volumes baixos por mídia, recalculamos por scan da
-- tabela inteira para o `media_id` afetado. Pra alto volume, troca
-- pra padrão "delta" (incrementa/decrementa direto no NEW.media_id).

CREATE OR REPLACE FUNCTION recalcular_media_likes(p_media UUID)
RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM "media_likes" WHERE "media_id" = p_media;
    UPDATE "medias" SET "likes_count" = v_count WHERE "id" = p_media;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalcular_media_comments(p_media UUID)
RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM "media_comments" WHERE "media_id" = p_media;
    UPDATE "medias" SET "comments_count" = v_count WHERE "id" = p_media;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_media_likes_agg()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM recalcular_media_likes(NEW."media_id");
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM recalcular_media_likes(OLD."media_id");
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_media_comments_agg()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM recalcular_media_comments(NEW."media_id");
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM recalcular_media_comments(NEW."media_id");
        IF OLD."media_id" <> NEW."media_id" THEN
            PERFORM recalcular_media_comments(OLD."media_id");
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM recalcular_media_comments(OLD."media_id");
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_likes_agg
AFTER INSERT OR DELETE ON "media_likes"
FOR EACH ROW EXECUTE FUNCTION trigger_media_likes_agg();

CREATE TRIGGER trg_media_comments_agg
AFTER INSERT OR UPDATE OR DELETE ON "media_comments"
FOR EACH ROW EXECUTE FUNCTION trigger_media_comments_agg();
