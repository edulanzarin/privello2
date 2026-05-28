-- Sistema de Reels — parte 2: tabela ReelView, novas colunas em
-- `medias` e índice parcial pro feed.

-- 1) Campos opcionais em Media pra suportar vídeos.
ALTER TABLE "medias"
    ADD COLUMN "duration_seconds" INTEGER,
    ADD COLUMN "poster_storage_key" TEXT;

-- 2) Tabela ReelView — quem viu qual reel.
--    Composta `(media_id, user_id)` única; index por viewer pra
--    quota diária ("quantos reels este user viu hoje?").
CREATE TABLE "reel_views" (
    "media_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("media_id", "user_id"),
    CONSTRAINT "reel_views_media_fk" FOREIGN KEY ("media_id")
        REFERENCES "medias"("id") ON DELETE CASCADE,
    CONSTRAINT "reel_views_user_fk" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_reel_views_user_viewed"
    ON "reel_views" ("user_id", "viewed_at" DESC);

-- 3) Indexes pra busca de feed.
--    Filtro principal: role=REEL + status=COMMITTED + owner ativo.
--    Ordem secundária: createdAt DESC pra ranking de recentes.
CREATE INDEX "idx_medias_reels_active"
    ON "medias" ("role", "status", "created_at" DESC)
    WHERE "role" = 'REEL' AND "status" = 'COMMITTED';
