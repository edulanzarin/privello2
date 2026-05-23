-- Migration: galeria de mídias (fotos + vídeos) publicáveis pela
-- Acompanhante.
--
-- 1. Novo enum `MediaKind` discrimina entre foto e vídeo no nível do
--    banco para que queries possam filtrar/aggregar sem inspecionar o
--    `mime_type` cru.
-- 2. Coluna `description` (texto curto, até 150 chars na camada de
--    aplicação; mantida como TEXT no banco para flexibilidade) que
--    acompanha cada mídia da galeria. `NULL` quando não há descrição
--    (incluindo a Foto_de_Perfil, que não tem campo descritivo).
-- 3. Coluna `kind` com default `PHOTO` para preencher linhas
--    existentes sem afetar o cadastro/onboarding atual.

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- AlterTable
ALTER TABLE "medias"
ADD COLUMN "kind" "MediaKind" NOT NULL DEFAULT 'PHOTO',
ADD COLUMN "description" TEXT;

-- Index para listar a galeria de um usuário ordenada por recência,
-- excluindo a Foto_de_Perfil. Usado por
-- `Sistema_de_Galeria.listar(userId)`. O nome do índice segue a
-- convenção do Prisma (`<table>_<col>_<col>..._idx`) para que o
-- shadow database aceite a migration sem reclamar de drift.
CREATE INDEX "medias_owner_id_is_profile_photo_status_created_at_idx"
ON "medias" ("owner_id", "is_profile_photo", "status", "created_at" DESC);
