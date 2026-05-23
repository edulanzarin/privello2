-- Migration: atendimento da Acompanhante.
--
-- Dois novos arrays:
--   1. `atende_publicos`: público que ela atende (MULHER/HOMEM/CASAL/TRANS).
--   2. `realiza_praticas`: o que ela realiza. Lista enxuta de atos
--      "core" (oral, vaginal, anal, beijo, massagem) + uma marcação
--      genérica `FETICHE` que sinaliza disponibilidade para fetiches
--      específicos sem listar cada um (o detalhe fica na conversa
--      privada Cliente↔Acompanhante).
--
-- Tudo opcional — Acompanhante existente fica com array vazio até
-- editar o perfil. UI obriga preenchimento no Onboarding novo.

-- CreateEnum
CREATE TYPE "Atende" AS ENUM ('MULHER', 'HOMEM', 'CASAL', 'TRANS');

-- CreateEnum: práticas (atos core + opção genérica de fetiche).
CREATE TYPE "Pratica" AS ENUM (
    'ORAL',
    'VAGINAL',
    'ANAL',
    'BEIJO_NA_BOCA',
    'MASSAGEM',
    'FETICHE'
);

-- AlterTable
ALTER TABLE "acompanhante_profiles"
ADD COLUMN "atende_publicos" "Atende"[] NOT NULL DEFAULT ARRAY[]::"Atende"[],
ADD COLUMN "realiza_praticas" "Pratica"[] NOT NULL DEFAULT ARRAY[]::"Pratica"[];
