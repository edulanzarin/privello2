-- Boost programado (T09).
--
-- Acompanhante agenda Boost pra começar em data/hora futura (ex:
-- "começar sexta 18h"). Útil pra pegar tráfego de fim de semana.
--
-- `start_at`:
--   - NULL = começar imediatamente (comportamento atual).
--   - timestamp futuro = o webhook aprova o pagamento mas NÃO
--     estende `boostUntil`. O cron noturno
--     (`ativarBoostsAgendados`) ativa quando `start_at <= now`.
--
-- Flag de idempotência da ativação: `activates_at IS NULL`. Só
-- ativa quem ainda não foi ativado. Index parcial cobre a query
-- do cron sem varrer a tabela inteira.

ALTER TABLE "boost_payments"
    ADD COLUMN "start_at" TIMESTAMP(3) NULL;

-- Index pra o cron: encontra boosts aprovados, agendados e ainda
-- não ativados que já chegaram a hora.
CREATE INDEX IF NOT EXISTS "idx_boost_payments_agendados"
    ON "boost_payments" ("status", "activates_at", "start_at");
