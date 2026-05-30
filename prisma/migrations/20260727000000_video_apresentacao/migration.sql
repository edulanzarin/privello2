-- Vídeo de apresentação (Plano_Premium).
--
-- Vídeo curto (≤60s) substituindo ou complementando o áudio de
-- apresentação. Slot único no `acompanhante_profiles` —
-- substituição marca o anterior como DELETED (mesmo padrão do
-- foto/capa/áudio).
--
-- Reusa `Media` com novo role `VIDEO_PRESENTATION`. O reuse de
-- `posterStorageKey` (já existente para REEL) cobre o frame de
-- preview.

ALTER TYPE "MediaRole" ADD VALUE IF NOT EXISTS 'VIDEO_PRESENTATION';

ALTER TABLE "acompanhante_profiles"
    ADD COLUMN "video_apresentacao_id" UUID NULL UNIQUE;

ALTER TABLE "acompanhante_profiles"
    ADD CONSTRAINT "fk_acompanhante_profiles_video_apresentacao"
        FOREIGN KEY ("video_apresentacao_id") REFERENCES "medias" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
