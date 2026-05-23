-- Sistema_de_Planos_Cliente — plano vigente por Cliente.
--
-- Cliente também tem plano: `GRATIS` (default ao escolher) e `FAN`
-- (acessa avaliações, comentários e curtidas de terceiros). Diferente
-- da Acompanhante, o plano não bloqueia acesso à plataforma — quando
-- `planoVigente IS NULL`, o usuário ainda não passou pela tela de
-- seleção mas pode usar a home como visitante autenticado.

-- CreateEnum
CREATE TYPE "PlanoClienteTipo" AS ENUM ('GRATIS', 'FAN');

-- AlterTable
ALTER TABLE "client_profiles"
ADD COLUMN "plano_vigente" "PlanoClienteTipo",
ADD COLUMN "plano_selecionado_em" TIMESTAMP(3);
