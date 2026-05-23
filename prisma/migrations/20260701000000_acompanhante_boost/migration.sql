-- Migration: Boost da Acompanhante.
--
-- "Boost" é uma promoção paga de 24h que dá prioridade total nas
-- buscas e destaque na home. Independente do plano vigente
-- (Básico/Premium): qualquer Acompanhante pode comprar boost.
--
-- Modelo de dados:
--   - Coluna `boost_until` em `acompanhante_profiles`: timestamp do
--     fim do boost ativo. `NULL` ou no passado = sem boost.
--   - Tabela `boost_payment`: registro de cada compra. Trilha de
--     auditoria + idempotência via `mp_preference_id` (UNIQUE).
--     Quando o webhook do Mercado Pago confirma o pagamento, a
--     função `processarWebhookBoost` atualiza `status` do registro
--     e estende `boost_until` em +24h a partir de NOW().
--
-- Status do pagamento:
--   - PENDING:   preferência criada, aguardando confirmação MP.
--   - APPROVED:  pagamento confirmado, boost ativado.
--   - REJECTED:  MP recusou. Sem boost.
--   - REFUNDED:  estorno (raro). Boost continua válido até expirar.

ALTER TABLE "acompanhante_profiles"
ADD COLUMN "boost_until" TIMESTAMP(3);

CREATE INDEX "acompanhante_profiles_boost_until_idx"
ON "acompanhante_profiles" ("boost_until");

-- Status do pagamento de boost.
CREATE TYPE "BoostPaymentStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'REFUNDED'
);

CREATE TABLE "boost_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "BoostPaymentStatus" NOT NULL DEFAULT 'PENDING',
    -- ID interno gerado por nós e enviado ao MP como `external_reference`.
    -- Usado para reconciliar o webhook (que vem com `external_reference`)
    -- com o registro local sem depender de IDs do MP.
    "external_reference" VARCHAR(80) NOT NULL,
    -- ID da preference criada no MP. Imutável após criação.
    "mp_preference_id" VARCHAR(120),
    -- ID do payment do MP. Preenchido quando o webhook confirma.
    "mp_payment_id" VARCHAR(120),
    -- Janela ativada por este pagamento. NULL até APPROVED.
    "activates_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boost_payments_pkey" PRIMARY KEY ("id")
);

-- Idempotência: cada `external_reference` é único. Usado para
-- detectar webhooks duplicados.
CREATE UNIQUE INDEX "boost_payments_external_reference_key"
ON "boost_payments" ("external_reference");

-- `mp_preference_id` único quando presente. Em PostgreSQL, UNIQUE
-- aceita múltiplos NULLs por padrão, então uma constraint
-- normal cobre a semântica desejada (cada preference do MP só
-- pode aparecer uma vez na tabela).
CREATE UNIQUE INDEX "boost_payments_mp_preference_id_key"
ON "boost_payments" ("mp_preference_id");

CREATE INDEX "boost_payments_user_id_status_created_at_idx"
ON "boost_payments" ("user_id", "status", "created_at" DESC);

ALTER TABLE "boost_payments"
ADD CONSTRAINT "boost_payments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
