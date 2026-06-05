-- Adiciona plano_expira_em ao perfil da acompanhante (expiry lazy igual ao FanPayment do cliente)
ALTER TABLE "acompanhante_profiles" ADD COLUMN "plano_expira_em" TIMESTAMP(3);

-- Cria tabela de pagamentos de plano da acompanhante (Básico / Premium)
CREATE TABLE "plano_acompanhante_payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "plano" "PlanoTipo" NOT NULL,
  "status" "BoostPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "external_reference" VARCHAR(80) NOT NULL UNIQUE,
  "stripe_session_id" VARCHAR(120) UNIQUE,
  "stripe_payment_intent_id" VARCHAR(120),
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "plano_acompanhante_payments_user_id_status_created_at_idx"
  ON "plano_acompanhante_payments"("user_id", "status", "created_at" DESC);
