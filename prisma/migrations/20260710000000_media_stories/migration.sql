-- Migration: Stories.
--
-- Adiciona o role `STORY` e a coluna `expires_at` em `medias`.
-- Stories são publicados por Acompanhante Premium (`permiteStories`)
-- e expiram automaticamente após 24 horas. A expiração é aplicada via
-- filtro no read (status COMMITTED + expires_at > now()) e via cron
-- lazy de garbage collection que muda `status` para DELETED.
--
-- O `expires_at` é nullable: para roles `PROFILE`, `COVER`, `AUDIO`,
-- `GALLERY` permanece NULL e a Media nunca expira automaticamente.

-- Adiciona STORY ao enum MediaRole (Postgres exige ALTER TYPE).
ALTER TYPE "MediaRole" ADD VALUE 'STORY';

-- Coluna de expiração.
ALTER TABLE "medias"
ADD COLUMN "expires_at" TIMESTAMP(3);

-- Índice para a query de listagem de stories ativos:
--   WHERE role = 'STORY' AND status = 'COMMITTED' AND expires_at > now()
CREATE INDEX "medias_role_status_expires_at_idx"
ON "medias" ("role", "status", "expires_at");
