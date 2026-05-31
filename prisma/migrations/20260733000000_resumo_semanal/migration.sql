-- Resumo semanal in-site (W3).
--
-- Adiciona a categoria RESUMO_SEMANAL ao enum NotificationType.
-- O cron (runCleanup → enviarResumosSemanais) gera, no máximo uma
-- vez a cada 7 dias por Acompanhante, uma notificação com o
-- consolidado da semana (visitas, curtidas, favoritos novos,
-- perguntas pendentes). A guarda de cadência é por consulta
-- (última notificação RESUMO_SEMANAL nos últimos 7 dias) — sem
-- coluna nova.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESUMO_SEMANAL';
