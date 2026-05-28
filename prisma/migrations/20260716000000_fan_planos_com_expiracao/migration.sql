-- Plano Fan agora tem duração variável (24h, 7d, 30d).
--
-- Mudanças:
--
--   1. Reverter o experimento de "conta efêmera" (isEphemeral
--      e expires_at em users) — adotamos abordagem mais simples
--      onde Cliente sempre tem conta normal, com plano que tem
--      data de expiração.
--
--   2. Reverter o valor `FAN_24H` do enum PlanoClienteTipo —
--      em vez disso o plano `FAN` ganha campo `planoExpiraEm` que
--      define quando o benefício termina.
--
--   3. Adicionar `plano_expira_em` em client_profiles.
--
-- Modelo final:
--   - Cliente sempre tem User normal (com email, identificador,
--     senha).
--   - ClientProfile.planoVigente: GRATIS | FAN.
--   - ClientProfile.planoExpiraEm: NULL pra GRATIS, ou data
--     futura pra FAN. Quando passa, o sistema lê como GRATIS
--     (downgrade lazy no read).

-- 1) Adiciona coluna `plano_expira_em` em client_profiles.
ALTER TABLE "client_profiles"
    ADD COLUMN "plano_expira_em" TIMESTAMP(3);

-- 2) Remove flags de conta efêmera (que nem chegou a ser usada
--    em produção, é segura de remover).
DROP INDEX IF EXISTS "idx_users_ephemeral_expires";

ALTER TABLE "users"
    DROP COLUMN IF EXISTS "is_ephemeral",
    DROP COLUMN IF EXISTS "expires_at";

-- 3) Reverter o enum: remove `FAN_24H`. Postgres não suporta
--    DROP VALUE diretamente — recriamos o enum.
--
--    Antes garantimos que nenhum cliente está com `FAN_24H`
--    (cenário plausível só se o seed/teste tiver gravado).
UPDATE "client_profiles"
    SET "plano_vigente" = 'FAN'
    WHERE "plano_vigente" = 'FAN_24H';

ALTER TYPE "PlanoClienteTipo" RENAME TO "PlanoClienteTipo_old";

CREATE TYPE "PlanoClienteTipo" AS ENUM ('GRATIS', 'FAN');

ALTER TABLE "client_profiles"
    ALTER COLUMN "plano_vigente" TYPE "PlanoClienteTipo"
    USING ("plano_vigente"::text::"PlanoClienteTipo");

DROP TYPE "PlanoClienteTipo_old";
