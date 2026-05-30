-- Adiciona ordem manual na galeria.
--
-- Acompanhante arrasta mídias pra reordenar; persiste em
-- `medias.sort_order`. Default 0 — itens nunca reordenados caem no
-- tiebreaker por `createdAt desc` (mantém o comportamento atual
-- antes da feature).
--
-- Aplicável só pra `role=GALLERY` (outros roles ignoram). Um perfil
-- típico tem dezenas de mídias no máximo, então atualizar todas em
-- uma transação é barato — a feature não precisa de um índice
-- especializado em (owner_id, sort_order).
--
-- Mantemos o índice composto existente em
-- (owner_id, role, status, created_at desc) — combinado com
-- ORDER BY sort_order asc, created_at desc o Postgres faz seq scan
-- do subset filtrado e ordena em memória, OK pro volume esperado.

ALTER TABLE "medias"
    ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
