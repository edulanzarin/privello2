-- Stories Highlights (Destaques permanentes).
--
-- Acompanhante seleciona Stories arquivados pra montar "Destaques"
-- estilo Instagram — agrupados por `highlight_title`. Aparecem no
-- perfil público em rail circular acima da galeria, por tempo
-- indefinido (sem expiração). Clicar abre os stories daquele
-- destaque em sequência.
--
-- Apenas Stories ARCHIVED podem ser tagueados — não faz sentido
-- "destacar" algo que ainda está ativo (vai expirar daqui a horas
-- e mover automaticamente pra ARCHIVED). O write-path do service
-- garante isso; o banco não precisa de constraint extra.
--
-- # Por que título string em vez de tabela separada?
--
-- Volume baixo (cada Acompanhante tem ~3-10 destaques no máximo).
-- Uma tabela `highlights(id, title, owner_id, cover_media_id)`
-- daria normalização e título único, mas dobraria o número de
-- queries — pra cada visita ao perfil teríamos: 1 query nos
-- destaques + N queries nos stories de cada destaque. Com string
-- inline, agrupamos em uma única query usando `GROUP BY
-- highlight_title`.

ALTER TABLE "medias"
    ADD COLUMN "highlight_title" TEXT NULL,
    ADD COLUMN "highlight_order" INTEGER NULL;

-- Index pra acelerar listagem de destaques por dono. Cobre as
-- duas queries principais (lista de títulos distintos do dono +
-- stories de um título específico).
CREATE INDEX IF NOT EXISTS "idx_medias_highlight_owner"
    ON "medias" ("owner_id", "highlight_title", "highlight_order")
    WHERE "highlight_title" IS NOT NULL;
