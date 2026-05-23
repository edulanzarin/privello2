-- Migration: atendimento comercial da Acompanhante.
--
-- Três conjuntos de informação que orientam a transação Cliente↔
-- Acompanhante:
--
--   1. `valor_hora_cents`: preço da hora em centavos (BRL). Inteiro
--      pra evitar imprecisão de ponto flutuante. Opcional — pode ser
--      definido depois pelo painel.
--   2. `formas_pagamento`: array de enums (PIX, dinheiro, etc.).
--   3. `dias_atende`: array de dias da semana (SEG..DOM).
--
-- Tudo opcional pra Acompanhantes existentes. Onboarding novo obriga
-- preenchimento. Painel edita.

CREATE TYPE "FormaPagamento" AS ENUM (
    'DINHEIRO',
    'PIX',
    'CARTAO_CREDITO',
    'CARTAO_DEBITO',
    'TRANSFERENCIA'
);

CREATE TYPE "DiaSemana" AS ENUM (
    'SEG',
    'TER',
    'QUA',
    'QUI',
    'SEX',
    'SAB',
    'DOM'
);

ALTER TABLE "acompanhante_profiles"
ADD COLUMN "valor_hora_cents" INTEGER,
ADD COLUMN "formas_pagamento" "FormaPagamento"[] NOT NULL DEFAULT ARRAY[]::"FormaPagamento"[],
ADD COLUMN "dias_atende" "DiaSemana"[] NOT NULL DEFAULT ARRAY[]::"DiaSemana"[];
