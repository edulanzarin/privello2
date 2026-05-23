-- Migration: Áudio_de_Apresentação da Acompanhante.
--
-- Recurso exclusivo do Plano_Premium ("Ouça minha voz"). A
-- Acompanhante grava direto pelo navegador (10s a 60s), revisa e
-- confirma o envio. O blob webm/mp4 vai pra R2 igual qualquer outra
-- mídia e fica linkado em `acompanhante_profiles.audio_apresentacao_id`.
--
-- Reusamos a tabela `medias` em vez de criar uma `audios` separada
-- porque:
--   1. Stage→commit, retry, PENDING_REPAIR e cleanup já estão
--      implementados pra Media — só precisamos de um novo `kind`.
--   2. O dono já é `User`, mesmo padrão de quota e ownership.
--   3. `is_profile_photo: true` evita que o áudio apareça na
--      galeria pública (`listarGaleria` filtra por
--      `is_profile_photo: false`). É a mesma flag usada por
--      Foto_de_Perfil e Capa_de_Perfil — todas "mídias de sistema",
--      auto-gerenciadas, com no máximo uma instância ativa por
--      usuário.

-- AlterEnum: novo `kind` AUDIO para diferenciar de PHOTO/VIDEO.
ALTER TYPE "MediaKind" ADD VALUE 'AUDIO';

-- AlterTable: FK 1:1 com `medias`. Idêntico ao padrão de `foto_perfil_id`
-- e `capa_perfil_id`, que viraram precedente bem-sucedido.
ALTER TABLE "acompanhante_profiles"
ADD COLUMN "audio_apresentacao_id" UUID;

ALTER TABLE "acompanhante_profiles"
ADD CONSTRAINT "acompanhante_profiles_audio_apresentacao_id_key"
UNIQUE ("audio_apresentacao_id");

ALTER TABLE "acompanhante_profiles"
ADD CONSTRAINT "acompanhante_profiles_audio_apresentacao_id_fkey"
FOREIGN KEY ("audio_apresentacao_id")
REFERENCES "medias"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
