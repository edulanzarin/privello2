-- Migration: papel discriminado de cada Media.
--
-- Substitui o flag binário `is_profile_photo` por um enum
-- `MediaRole` com 4 valores explícitos. O flag antigo virou
-- sobrecarregado: significava "é uma mídia gerenciada pelo
-- sistema?" (foto de perfil + capa + áudio) e qualquer query
-- futura que filtrasse por ele esperando "só foto de perfil"
-- traria capa e áudio também. Com o enum, cada papel é
-- inspecionável e auto-documentado:
--
--   - PROFILE: a Foto_de_Perfil de um User (Cliente ou Acompanhante).
--   - COVER:   a Capa_de_Perfil de uma Acompanhante (banner horizontal).
--   - AUDIO:   o Áudio_de_Apresentação ("Ouça minha voz") da Acompanhante.
--   - GALLERY: mídia publicada na galeria pública (foto ou vídeo).
--
-- Estratégia segura: criamos a coluna como nullable, populamos
-- com base nos ponteiros existentes em `client_profiles` e
-- `acompanhante_profiles`, e só depois forçamos NOT NULL.

-- 1. Cria o enum.
CREATE TYPE "MediaRole" AS ENUM ('PROFILE', 'COVER', 'AUDIO', 'GALLERY');

-- 2. Adiciona a coluna nullable.
ALTER TABLE "medias"
ADD COLUMN "role" "MediaRole";

-- 3. Backfill: marca cada Media com seu papel real, derivado dos
--    profiles que apontam pra ela. A ordem importa: PROFILE,
--    depois COVER, depois AUDIO, depois GALLERY como fallback.

-- 3a. Foto de perfil (Cliente + Acompanhante).
UPDATE "medias" SET "role" = 'PROFILE'
WHERE "id" IN (
    SELECT "foto_perfil_id" FROM "client_profiles"
    WHERE "foto_perfil_id" IS NOT NULL
    UNION
    SELECT "foto_perfil_id" FROM "acompanhante_profiles"
    WHERE "foto_perfil_id" IS NOT NULL
);

-- 3b. Capa de perfil (Acompanhante).
UPDATE "medias" SET "role" = 'COVER'
WHERE "id" IN (
    SELECT "capa_perfil_id" FROM "acompanhante_profiles"
    WHERE "capa_perfil_id" IS NOT NULL
);

-- 3c. Áudio de apresentação (Acompanhante).
UPDATE "medias" SET "role" = 'AUDIO'
WHERE "id" IN (
    SELECT "audio_apresentacao_id" FROM "acompanhante_profiles"
    WHERE "audio_apresentacao_id" IS NOT NULL
);

-- 3d. Histórico: Medias com `is_profile_photo = true` que não estão
--     mais referenciadas (status DELETED de uma capa antiga, por
--     exemplo) — derivamos pelo kind. PHOTO → PROFILE (caso default,
--     já que era o caso mais comum); AUDIO → AUDIO. Pode haver
--     algum caso ambíguo, mas como essas Medias estão DELETED não
--     afetam nenhuma consulta ativa.
UPDATE "medias" SET "role" = 'AUDIO'
WHERE "role" IS NULL AND "kind" = 'AUDIO';

UPDATE "medias" SET "role" = 'PROFILE'
WHERE "role" IS NULL AND "is_profile_photo" = true;

-- 3e. Resto: galeria pública.
UPDATE "medias" SET "role" = 'GALLERY'
WHERE "role" IS NULL;

-- 4. Marca como NOT NULL agora que todas as linhas têm valor.
ALTER TABLE "medias"
ALTER COLUMN "role" SET NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'GALLERY';

-- 5. Substitui o índice composto antigo (que usava `is_profile_photo`)
--    por um equivalente que usa `role`. Listagem de galeria filtra
--    por `role = 'GALLERY' AND status = 'COMMITTED'` ordenada por
--    `created_at DESC`.
DROP INDEX "medias_owner_id_is_profile_photo_status_created_at_idx";

CREATE INDEX "medias_owner_id_role_status_created_at_idx"
ON "medias" ("owner_id", "role", "status", "created_at" DESC);

-- 6. Mantém `is_profile_photo` por enquanto como redundância (não
--    remove agora pra evitar quebrar deploys em flight). Será
--    removido em uma migration de cleanup futura quando todo o
--    código tiver migrado para `role`.
