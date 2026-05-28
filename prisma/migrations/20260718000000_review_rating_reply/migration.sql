-- Avaliação: adiciona nota numérica opcional + resposta da Acompanhante.
--
-- Nota numérica (1-5) volta como **opcional** — o Cliente pode
-- avaliar só com texto se quiser. A nota agregada é exposta atrás
-- de gate Fan no perfil ("Ver nota geral").
--
-- Resposta da Acompanhante: 1 resposta por avaliação. Sobrescrever
-- atualiza o texto e o `replied_at` (idempotente). `replied_at`
-- ausente significa que ainda não respondeu.

ALTER TABLE "acompanhante_reviews"
    ADD COLUMN "rating" INTEGER,
    ADD COLUMN "reply_text" VARCHAR(2000),
    ADD COLUMN "replied_at" TIMESTAMP(3),
    ADD CONSTRAINT "chk_review_rating_range"
        CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));
