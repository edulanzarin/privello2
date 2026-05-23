-- Sistema_de_Cadastro_Cliente — Foto_de_Perfil opcional para Cliente.
--
-- Adiciona `client_profiles.foto_perfil_id` opcional, simétrico ao
-- `acompanhante_profiles.foto_perfil_id`, com índice único e foreign
-- key apontando para `medias`. Permite que um Cliente tenha (no máximo)
-- uma Foto_de_Perfil enquanto mantém a obrigatoriedade da foto apenas
-- para Acompanhante (Requirements 2 e 3).

-- AlterTable
ALTER TABLE "client_profiles"
ADD COLUMN "foto_perfil_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_foto_perfil_id_key"
ON "client_profiles"("foto_perfil_id");

-- AddForeignKey
ALTER TABLE "client_profiles"
ADD CONSTRAINT "client_profiles_foto_perfil_id_fkey"
FOREIGN KEY ("foto_perfil_id") REFERENCES "medias"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
