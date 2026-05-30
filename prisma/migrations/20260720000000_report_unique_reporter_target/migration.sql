-- Unique parcial: 1 denúncia ATIVA por (reporter, target).
--
-- O usuário pode denunciar de novo o mesmo alvo se a denúncia
-- anterior já foi RESOLVIDA ou DESCARTADA — afinal o alvo pode
-- ter mudado o comportamento e voltar a ofender. Por isso o
-- index é parcial em `status = 'PENDENTE'`: bloqueia spam de
-- denúncias enquanto a primeira ainda não foi triada, mas
-- preserva o histórico (que tem `RESOLVIDA`/`DESCARTADA`
-- coexistindo).
--
-- Antes de criar o index, normaliza eventuais duplicatas legadas
-- mantendo só a denúncia mais antiga. Sem isso o `CREATE UNIQUE
-- INDEX` falharia em prod com dados existentes.

DELETE FROM "reports" r1
USING "reports" r2
WHERE r1.status = 'PENDENTE'
  AND r2.status = 'PENDENTE'
  AND r1.reporter_user_id = r2.reporter_user_id
  AND r1.target_type = r2.target_type
  AND r1.target_id = r2.target_id
  AND r1.criada_em > r2.criada_em;

CREATE UNIQUE INDEX "uq_reports_reporter_target_pendente"
    ON "reports" ("reporter_user_id", "target_type", "target_id")
    WHERE "status" = 'PENDENTE';
