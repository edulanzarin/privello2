-- Migration: visibilidade do perfil da Acompanhante.
--
-- Toggle binário que decide:
--   - se a Acompanhante aparece nos resultados do
--     `Sistema_de_Busca_Acompanhantes` (futuro);
--   - se o perfil público em `/acompanhantes/[slug]` exibe os
--     dados ou cai na tela "perfil oculto ou desativado".
--
-- A mesma tela "oculto" também serve para perfis sem `planoVigente`
-- (quando o plano expira e a Acompanhante não renova). Diferenciar
-- "oculto por escolha" de "expirado por inadimplência" não muda a
-- experiência do visitante — ambos os casos terminam no mesmo
-- estado. O painel privado da Acompanhante diferencia internamente.
--
-- Default `true` mantém o comportamento atual: perfis novos já
-- nascem visíveis e a Acompanhante decide ocultar quando quiser.

ALTER TABLE "acompanhante_profiles"
ADD COLUMN "perfil_visivel" BOOLEAN NOT NULL DEFAULT true;

-- Índice para a busca futura: filtra rapidamente perfis visíveis.
-- Inclui `plano_vigente` porque qualquer query de busca pública
-- vai exigir os dois ao mesmo tempo (visível E com plano).
CREATE INDEX "acompanhante_profiles_perfil_visivel_plano_vigente_idx"
ON "acompanhante_profiles" ("perfil_visivel", "plano_vigente");
