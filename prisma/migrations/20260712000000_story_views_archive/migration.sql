-- Migration: visualizações de Story + estado ARCHIVED.
--
-- 1. Adiciona o valor `ARCHIVED` em `MediaStatus`. Stories que
--    expiraram naturalmente ficam em ARCHIVED (mantém likes
--    contando no total e visíveis no painel privado da
--    Acompanhante). DELETED segue significando "removido pelo
--    dono ou por moderação".
--
-- 2. Cria a tabela `story_views` para registrar quem viu cada
--    Story. Usado pra colorir o ring do avatar no perfil
--    público (colorido quando há story não visto, cinza quando
--    todos foram vistos).

ALTER TYPE "MediaStatus" ADD VALUE 'ARCHIVED';

CREATE TABLE "story_views" (
    "media_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_views_pkey" PRIMARY KEY ("media_id", "user_id")
);

ALTER TABLE "story_views"
ADD CONSTRAINT "story_views_media_id_fkey"
FOREIGN KEY ("media_id") REFERENCES "medias"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "story_views"
ADD CONSTRAINT "story_views_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "story_views_user_id_viewed_at_idx"
ON "story_views" ("user_id", "viewed_at" DESC);
