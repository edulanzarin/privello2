-- Topic Audios — parte 1 de 2: cria os tipos.
--
-- Recurso pra Acompanhante gravar respostas em áudio (≤30s) pra
-- perguntas frequentes: "Preço", "Atende casal?", "Disponibilidade"
-- etc. Aparecem como FAQ sonora no perfil público.
--
-- # Por que dividida em 2 migrations
--
-- Postgres exige que valores novos de um enum só sejam usados em
-- uma transação **diferente** da que os adicionou (erro 55P04:
-- "unsafe use of new value of enum type"). O Prisma roda cada
-- migration numa transação. Por isso:
--
--   - Esta migration apenas CRIA o enum `TopicAudioKind` e ADICIONA
--     o valor `TOPIC_AUDIO` ao enum existente `MediaRole`.
--   - A migration adjacente `20260726000100_topic_audios_part2` usa
--     o novo valor (coluna + índice unique parcial).
--
-- # Idempotência
--
-- `CREATE TYPE` e `ALTER TYPE ADD VALUE` são auto-commit no Postgres
-- e podem ter persistido em uma execução anterior que falhou nas
-- etapas seguintes. Usamos guards pra que rerunning não quebre.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'TopicAudioKind'
    ) THEN
        CREATE TYPE "TopicAudioKind" AS ENUM (
            'PRECO',
            'CASAL',
            'DISPONIBILIDADE',
            'LOCAL',
            'PRATICAS',
            'PAGAMENTO'
        );
    END IF;
END$$;

ALTER TYPE "MediaRole" ADD VALUE IF NOT EXISTS 'TOPIC_AUDIO';
