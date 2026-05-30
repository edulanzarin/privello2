-- Stats avançados (T10).
--
-- Adiciona agregações por hora-do-dia × dia-da-semana (heatmap
-- 7×24), por origem da visita (busca/home/direct/compartilhado) e
-- contagem de cliques no WhatsApp (conversão).
--
-- # Decisões de modelagem
--
-- - **Hourly**: tabela separada `profile_hourly_stats` com PK
--   composta (user, weekday, hour). Espaço fixo: no máximo 168
--   linhas por perfil. Não cresce sem limite como seria uma
--   tabela por-timestamp.
-- - **Origin**: `profile_origin_stats` com PK (user, origin). No
--   máximo 4 linhas por perfil.
-- - **WhatsApp clicks**: agregado diário em `profile_daily_stats`
--   (coluna nova) + total agregado em `acompanhante_profiles`.

CREATE TYPE "ViewOrigin" AS ENUM (
    'BUSCA',
    'HOME',
    'DIRECT',
    'COMPARTILHADO'
);

ALTER TABLE "profile_daily_stats"
    ADD COLUMN "whatsapp_clicks" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "acompanhante_profiles"
    ADD COLUMN "whatsapp_clicks_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "profile_hourly_stats" (
    "user_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "pk_profile_hourly_stats" PRIMARY KEY (
        "user_id", "weekday", "hour"
    ),
    CONSTRAINT "fk_profile_hourly_stats_user"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "profile_origin_stats" (
    "user_id" UUID NOT NULL,
    "origin" "ViewOrigin" NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "pk_profile_origin_stats" PRIMARY KEY (
        "user_id", "origin"
    ),
    CONSTRAINT "fk_profile_origin_stats_user"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
