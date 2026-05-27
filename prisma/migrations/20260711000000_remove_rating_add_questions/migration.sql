-- Migration: remoção de notas em avaliações + adição de perguntas/respostas.
--
-- 1. Avaliações deixam de ter nota numérica. Mantemos apenas o
--    comentário escrito (que vira NOT NULL). `reviews_count` continua,
--    mas `reviews_average` some — tanto a coluna em
--    `acompanhante_profiles` quanto a função de recálculo são
--    redefinidas pra ignorar a média.
--
-- 2. Adicionamos a tabela `acompanhante_questions` (Q&A público no
--    perfil). Apenas Cliente Fan pode perguntar e ver. Acompanhante
--    responde no painel. Uma pergunta = 0 ou 1 resposta (campo
--    `answer` nullable na própria linha).
--
-- 3. Apaga reviews antigas que não têm comentário (a coluna era
--    opcional e o produto pre-rating provavelmente não exigia texto).
--    Usuários impactados podem reescrever a avaliação como texto.

-- 1a. Limpa reviews sem comentário (antes de tornar NOT NULL).
DELETE FROM "acompanhante_reviews" WHERE "comment" IS NULL OR length(trim("comment")) = 0;

-- 1b. Drop do CHECK e da coluna `rating`.
ALTER TABLE "acompanhante_reviews"
DROP CONSTRAINT IF EXISTS "acompanhante_reviews_rating_range";

ALTER TABLE "acompanhante_reviews"
DROP COLUMN "rating";

-- 1c. `comment` vira NOT NULL.
ALTER TABLE "acompanhante_reviews"
ALTER COLUMN "comment" SET NOT NULL;

-- 1d. Drop da coluna `reviews_average` em `acompanhante_profiles`.
ALTER TABLE "acompanhante_profiles"
DROP COLUMN "reviews_average";

-- 1e. Atualiza a função de recálculo para mexer apenas em count.
CREATE OR REPLACE FUNCTION recalcular_reviews_agregado(p_target UUID)
RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM "acompanhante_reviews"
    WHERE "target_user_id" = p_target;

    UPDATE "acompanhante_profiles"
    SET "reviews_count" = v_count
    WHERE "user_id" = p_target;
END;
$$ LANGUAGE plpgsql;

-- 2. Tabela acompanhante_questions.
CREATE TABLE "acompanhante_questions" (
    "id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "answer" VARCHAR(2000),
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acompanhante_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "acompanhante_questions_question_min" CHECK (char_length(trim("question")) > 0),
    CONSTRAINT "acompanhante_questions_answer_consistency" CHECK (
        ("answer" IS NULL AND "answered_at" IS NULL)
        OR ("answer" IS NOT NULL AND "answered_at" IS NOT NULL)
    )
);

ALTER TABLE "acompanhante_questions"
ADD CONSTRAINT "acompanhante_questions_target_user_id_fkey"
FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acompanhante_questions"
ADD CONSTRAINT "acompanhante_questions_author_user_id_fkey"
FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "acompanhante_questions_target_user_id_created_at_idx"
ON "acompanhante_questions" ("target_user_id", "created_at" DESC);

CREATE INDEX "acompanhante_questions_target_user_id_answered_at_idx"
ON "acompanhante_questions" ("target_user_id", "answered_at");
