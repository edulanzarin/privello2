-- Reverificação periódica (A6 da auditoria 2026-05).
--
-- Verificação aprovada vale por 180 dias. Após isso, a flag
-- `verificada` no `acompanhante_profiles` é rebaixada pra false e
-- o perfil perde o selo até reenviar selfie + documento.
--
-- Por que 180 dias:
--   - Curto o suficiente pra detectar mudanças na pessoa (foto
--     antiga não bate mais com selfie atual).
--   - Longo o suficiente pra não incomodar Acompanhantes ativas
--     (1x por semestre).
--
-- O cleanup noturno (já existente em `runCleanup`) roda uma query
-- que rebaixa verificações expiradas. UI mostra aviso quando
-- faltam < 14 dias pra expiração.

ALTER TABLE "verifications"
    ADD COLUMN "expira_em" TIMESTAMPTZ;

-- Backfill: verificações já APROVADAS recebem expiração de 180 dias
-- a partir de `revisada_em` (ou agora se NULL — não deveria
-- acontecer mas defensivo).
UPDATE "verifications"
SET "expira_em" = COALESCE("revisada_em", NOW()) + INTERVAL '180 days'
WHERE "status" = 'APROVADA';

-- Index pra cleanup eficiente (busca verificações APROVADAS com
-- expira_em vencido).
CREATE INDEX "idx_verifications_expira_em"
    ON "verifications" ("expira_em")
    WHERE "status" = 'APROVADA' AND "expira_em" IS NOT NULL;
