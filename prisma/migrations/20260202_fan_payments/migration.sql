-- Cria tabela de pagamentos de plano Fan do Cliente
CREATE TABLE "fan_payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "duracao" VARCHAR(20) NOT NULL,
  "status" "BoostPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "external_reference" VARCHAR(80) NOT NULL UNIQUE,
  "stripe_session_id" VARCHAR(120) UNIQUE,
  "stripe_payment_intent_id" VARCHAR(120),
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "fan_payments_user_id_status_created_at_idx" ON "fan_payments"("user_id", "status", "created_at" DESC);
