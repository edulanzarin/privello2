-- Onboarding_Acompanhante — bairro opcional + características físicas.
--
-- Adiciona ao `AcompanhanteProfile`:
--  - `bairro_nome`: bairro de atendimento (opcional, autocomplete via
--    Overpass/OSM).
--  - 12 atributos de aparência opcionais: peso, altura, tamanho do pé,
--    etnia, cor dos olhos, estilo e tamanho do cabelo, silicone,
--    tatuagens, piercing, fumante, idiomas.
--
-- Todos opcionais para permitir cadastros enxutos. Enums novos
-- (`Etnia`, `CorOlhos`, `EstiloCabelo`, `TamanhoCabelo`, `Fumante`,
-- `Idioma`) ficam disponíveis para reuso em filtros de busca.

-- CreateEnum
CREATE TYPE "Etnia" AS ENUM ('BRANCA', 'NEGRA', 'PARDA', 'AMARELA', 'INDIGENA');

-- CreateEnum
CREATE TYPE "CorOlhos" AS ENUM ('CASTANHO', 'PRETO', 'AZUL', 'VERDE', 'MEL', 'CINZA');

-- CreateEnum
CREATE TYPE "EstiloCabelo" AS ENUM ('LISO', 'ONDULADO', 'CACHEADO', 'CRESPO');

-- CreateEnum
CREATE TYPE "TamanhoCabelo" AS ENUM ('CURTO', 'MEDIO', 'LONGO');

-- CreateEnum
CREATE TYPE "Idioma" AS ENUM ('PORTUGUES', 'INGLES', 'ESPANHOL', 'FRANCES', 'ITALIANO', 'ALEMAO', 'OUTRO');

-- AlterTable
ALTER TABLE "acompanhante_profiles"
ADD COLUMN "bairro_nome"     TEXT,
ADD COLUMN "peso_kg"         INTEGER,
ADD COLUMN "altura_cm"       INTEGER,
ADD COLUMN "tamanho_pe"      INTEGER,
ADD COLUMN "etnia"           "Etnia",
ADD COLUMN "cor_olhos"       "CorOlhos",
ADD COLUMN "estilo_cabelo"   "EstiloCabelo",
ADD COLUMN "tamanho_cabelo"  "TamanhoCabelo",
ADD COLUMN "tem_silicone"    BOOLEAN,
ADD COLUMN "tem_tatuagens"   BOOLEAN,
ADD COLUMN "tem_piercing"    BOOLEAN,
ADD COLUMN "fumante"         BOOLEAN,
ADD COLUMN "idiomas"         "Idioma"[] NOT NULL DEFAULT ARRAY[]::"Idioma"[];
