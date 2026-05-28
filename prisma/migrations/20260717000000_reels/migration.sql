-- Sistema de Reels — vídeos curtos verticais públicos. Parte 1.
--
-- Postgres não permite usar um valor de enum recém-criado dentro
-- da mesma transação. Por isso esta migration adiciona apenas
-- o valor `REEL` ao enum `MediaRole`. A migration seguinte
-- (`20260717000100_reels_part2`) cria a tabela e os índices que
-- referenciam o valor.

ALTER TYPE "MediaRole" ADD VALUE 'REEL';
