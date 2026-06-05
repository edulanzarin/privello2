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
--
-- # Idempotência em bases limpas
--
-- A migration original assumia que `FAN_24H` existia no enum em
-- todas as bases (era um label deprecated que se quis remover).
-- Em bases novas (Railway/produção) o enum nunca teve `FAN_24H`,
-- e o `UPDATE ... WHERE plano_vigente = 'FAN_24H'` falhava com
-- 'invalid input value for enum'. A versão atual usa um bloco
-- DO/PL-pgSQL que checa se o label existe antes de mexer.

-- 1) Adiciona coluna `plano_expira_em` em client_profiles.
ALTER TABLE "client_profiles"
    ADD COLUMN IF NOT EXISTS "plano_expira_em" TIMESTAMP(3);

-- 2) Remove flags de conta efêmera (idempotente).
DROP INDEX IF EXISTS "idx_users_ephemeral_expires";

ALTER TABLE "users"
    DROP COLUMN IF EXISTS "is_ephemeral",
    DROP COLUMN IF EXISTS "expires_at";

-- 3) Normalizar o enum PlanoClienteTipo para `{GRATIS, FAN}`.
--
-- Em bases que tinham `FAN_24H` (deprecated), promove os clientes
-- pra `FAN` e recria o enum sem o label antigo. Em bases que
-- nunca tiveram `FAN_24H`, este bloco é no-op silencioso.
DO $$
BEGIN
    -- Só age se o label `FAN_24H` ainda existe no enum atual.
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'PlanoClienteTipo'
          AND e.enumlabel = 'FAN_24H'
    ) THEN
        -- Promove qualquer cliente com FAN_24H para FAN.
        EXECUTE 'UPDATE "client_profiles"
                 SET "plano_vigente" = ''FAN''
                 WHERE "plano_vigente"::text = ''FAN_24H''';

        -- Recria o enum sem o label antigo. O Postgres não
        -- suporta DROP VALUE, então usamos rename + recreate.
        EXECUTE 'ALTER TYPE "PlanoClienteTipo" RENAME TO "PlanoClienteTipo_old"';
        EXECUTE 'CREATE TYPE "PlanoClienteTipo" AS ENUM (''GRATIS'', ''FAN'')';
        EXECUTE 'ALTER TABLE "client_profiles"
                 ALTER COLUMN "plano_vigente" TYPE "PlanoClienteTipo"
                 USING ("plano_vigente"::text::"PlanoClienteTipo")';
        EXECUTE 'DROP TYPE "PlanoClienteTipo_old"';
    END IF;
END$$;
