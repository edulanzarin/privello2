-- Migration: foto de capa (banner horizontal) da Acompanhante.
--
-- Diferente da Foto_de_Perfil que aparece como avatar circular, a
-- capa é um banner horizontal acima do header (estilo Twitter/IG).
-- Aspect típico: 4:1. Optional — perfil sem capa cai num gradiente
-- tonal renderizado pelo `ProfileBanner` primitivo.

-- AlterTable
ALTER TABLE "acompanhante_profiles"
ADD COLUMN "capa_perfil_id" UUID;

-- AddForeignKey
ALTER TABLE "acompanhante_profiles"
ADD CONSTRAINT "acompanhante_profiles_capa_perfil_id_fkey"
FOREIGN KEY ("capa_perfil_id") REFERENCES "medias"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (unique para garantir 1:1)
CREATE UNIQUE INDEX "acompanhante_profiles_capa_perfil_id_key"
ON "acompanhante_profiles" ("capa_perfil_id");
