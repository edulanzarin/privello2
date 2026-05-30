-- Favoritos / Salvos.
--
-- Cliente marca Acompanhantes como favorita pra acessar rápido
-- depois. Cada par (cliente, acompanhante) é único — toggle
-- idempotente via INSERT ... ON CONFLICT DO NOTHING.
--
-- Cascade: se o Cliente OU a Acompanhante deletar a conta, os
-- registros somem automaticamente. Não há soft-delete — favorito
-- é estado leve, não tem histórico.
--
-- # Privacidade
--
-- A Acompanhante só vê o COUNT total de quem a salvou (mostrado
-- como métrica privada). NÃO vê quem é cada Cliente — isso seria
-- vazamento de dados de quem talvez queira manter discrição.
-- Cliente vê a lista das suas próprias favoritas.

CREATE TABLE "client_favorites" (
    "client_user_id" UUID NOT NULL,
    "acompanhante_user_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_client_favorites" PRIMARY KEY (
        "client_user_id", "acompanhante_user_id"
    ),
    CONSTRAINT "fk_client_favorites_client"
        FOREIGN KEY ("client_user_id") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_client_favorites_acompanhante"
        FOREIGN KEY ("acompanhante_user_id") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Lookup "minhas favoritas" do Cliente (ordem desc por adição).
CREATE INDEX "idx_client_favorites_client"
    ON "client_favorites" ("client_user_id", "criado_em" DESC);

-- Lookup "quantos clientes me salvaram" pra Acompanhante. Usa
-- count(*) — index só serve pra estreitar a varredura.
CREATE INDEX "idx_client_favorites_acompanhante"
    ON "client_favorites" ("acompanhante_user_id");
