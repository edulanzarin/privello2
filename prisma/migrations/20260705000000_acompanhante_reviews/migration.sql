-- Migration: avaliações de Acompanhante.
--
-- Cada `Cliente` autenticado pode deixar **1** avaliação por
-- `Acompanhante` (`UNIQUE (target_user_id, author_user_id)`). Atualizar
-- a avaliação reescreve a linha existente (UPSERT).
--
-- Campos agregados ficam materializados em `acompanhante_profiles`:
--   - `reviews_count`: total de avaliações.
--   - `reviews_average`: média ponderada (1..5), com 2 casas em uma
--     coluna numeric pra evitar imprecisão de float.
--
-- O agregado é atualizado via trigger no INSERT/UPDATE/DELETE da
-- tabela `acompanhante_reviews`. Um cron de reconciliação mensal
-- (ainda não criado) sincroniza tudo de novo se algo derivar.

ALTER TABLE "acompanhante_profiles"
ADD COLUMN "reviews_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reviews_average" NUMERIC(3, 2) NOT NULL DEFAULT 0;

CREATE TABLE "acompanhante_reviews" (
    "id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acompanhante_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "acompanhante_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);

-- Um Cliente só avalia uma Acompanhante uma vez. Reedição vira
-- UPSERT pelo par (target, author).
CREATE UNIQUE INDEX "acompanhante_reviews_target_user_id_author_user_id_key"
ON "acompanhante_reviews" ("target_user_id", "author_user_id");

CREATE INDEX "acompanhante_reviews_target_user_id_created_at_idx"
ON "acompanhante_reviews" ("target_user_id", "created_at" DESC);

ALTER TABLE "acompanhante_reviews"
ADD CONSTRAINT "acompanhante_reviews_target_user_id_fkey"
FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acompanhante_reviews"
ADD CONSTRAINT "acompanhante_reviews_author_user_id_fkey"
FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger de manutenção do agregado.
--
-- Recalcula `reviews_count` e `reviews_average` a partir do scan da
-- tabela inteira pra cada `target_user_id` afetado. É O(N) por linha
-- modificada, suficiente pra o volume previsto. Quando o volume
-- justificar, troca pro padrão "delta" (ler old/new e ajustar count
-- e soma sem scan).
CREATE OR REPLACE FUNCTION recalcular_reviews_agregado(p_target UUID)
RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
    v_avg NUMERIC(3, 2);
BEGIN
    SELECT COUNT(*), COALESCE(AVG("rating"), 0)
    INTO v_count, v_avg
    FROM "acompanhante_reviews"
    WHERE "target_user_id" = p_target;

    UPDATE "acompanhante_profiles"
    SET "reviews_count" = v_count,
        "reviews_average" = ROUND(v_avg, 2)
    WHERE "user_id" = p_target;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_reviews_agregado()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM recalcular_reviews_agregado(NEW."target_user_id");
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM recalcular_reviews_agregado(NEW."target_user_id");
        IF OLD."target_user_id" <> NEW."target_user_id" THEN
            PERFORM recalcular_reviews_agregado(OLD."target_user_id");
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM recalcular_reviews_agregado(OLD."target_user_id");
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_agregado
AFTER INSERT OR UPDATE OR DELETE ON "acompanhante_reviews"
FOR EACH ROW EXECUTE FUNCTION trigger_reviews_agregado();
