-- Migration: gênero da Acompanhante.
--
-- Necessário para que a busca pública filtre por MULHER / HOMEM /
-- TRANS. A coluna entra como NULL para Acompanhantes existentes —
-- elas vão ser obrigadas a preencher na próxima edição de perfil
-- (validação em camada de aplicação). Cadastros novos passam a
-- exigir gênero no Onboarding.

-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('MULHER', 'HOMEM', 'TRANS');

-- AlterTable
ALTER TABLE "acompanhante_profiles"
ADD COLUMN "genero" "Genero";
