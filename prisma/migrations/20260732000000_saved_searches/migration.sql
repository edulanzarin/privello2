-- Buscas salvas + alerta in-site (V3).
--
-- Cliente salva uma busca (cidade + filtros). Quando um perfil
-- novo passa a aparecer nas buscas e casa com os filtros salvos,
-- o Cliente recebe notificação in-site (reusa V2). Tudo no site,
-- nunca por email.
--
-- # Modelagem
--
-- - `filtros` JSONB guarda o shape `BuscaFiltros` (cidade, gênero,
--   etnia, faixa de preço, etc.) — flexível e sem 15 colunas.
-- - `label` é um rótulo amigável (ex.: "Curitiba, PR · Verificadas")
--   gerado no salvamento pra UI listar sem reparsear o JSON.
-- - `last_notified_at` evita reenviar a mesma correspondência: o
--   matcher só considera perfis publicados/atualizados depois dessa
--   marca.
--
-- Também estende o enum NotificationType com a categoria
-- BUSCA_NOVA_CORRESPONDENCIA, usada pelo alerta de busca salva.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUSCA_NOVA_CORRESPONDENCIA';

CREATE TABLE "saved_searches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_user_id" UUID NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "filtros" JSONB NOT NULL,
    "last_notified_at" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_saved_searches" PRIMARY KEY ("id"),
    CONSTRAINT "fk_saved_searches_client"
        FOREIGN KEY ("client_user_id") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_saved_searches_client"
    ON "saved_searches" ("client_user_id", "criado_em" DESC);
