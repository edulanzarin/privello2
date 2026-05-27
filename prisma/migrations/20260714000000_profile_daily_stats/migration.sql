-- Migration: estatísticas diárias por perfil.
--
-- Tabela enxuta pra alimentar o gráfico de visualizações + curtidas
-- por dia no painel da Acompanhante. Uma linha por (userId, day).
-- O serviço `incrementarStatDiaria` faz upsert na linha do dia
-- corrente.

CREATE TABLE "profile_daily_stats" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "profile_daily_stats_pkey" PRIMARY KEY ("user_id", "day")
);

CREATE INDEX "profile_daily_stats_user_id_day_idx"
ON "profile_daily_stats" ("user_id", "day" DESC);

ALTER TABLE "profile_daily_stats"
ADD CONSTRAINT "profile_daily_stats_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
