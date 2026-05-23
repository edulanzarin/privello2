-- Migration: contador agregado de visualizações públicas.
--
-- O perfil público da Acompanhante exibe um MetricPill de
-- "visualizações" para sinalizar tração. Como o sistema de eventos de
-- view (anti-fraude, agregação por janela) ainda não existe, fazemos
-- um contador agregado simples na tabela do perfil. Cada acesso ao
-- `/acompanhantes/[slug]` chama `incrementarVisualizacao(userId)` no
-- servidor, com cooldown via cookie de 6h por viewer (anônimo ou
-- autenticado) para evitar inflar com refresh.
--
-- Quando o `Sistema_de_Estatisticas` real chegar, este campo continua
-- sendo a fonte única do número exibido — o sistema novo só passa a
-- alimentar o agregado a partir dos eventos.

ALTER TABLE "acompanhante_profiles"
ADD COLUMN "views_count" INTEGER NOT NULL DEFAULT 0;
