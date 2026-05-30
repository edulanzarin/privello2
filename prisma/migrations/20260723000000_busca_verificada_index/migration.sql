-- Index parcial pra acelerar o filtro "Apenas verificadas" na busca.
--
-- A maioria dos perfis NÃO é verificada (a verificação exige selfie +
-- documento + revisão admin), logo um index full em `verificada` seria
-- desperdício. Index parcial sobre `verificada = true` cobre o
-- subconjunto pequeno e pula o resto — leitura mais barata e índice
-- compacto no disco.
--
-- Combinado com `perfilVisivel = true` e `planoVigente IS NOT NULL`
-- pra que o subconjunto coberto seja exatamente o que a query da busca
-- precisa quando o usuário ativa o filtro.

CREATE INDEX IF NOT EXISTS "idx_acompanhante_profiles_verificada"
    ON "acompanhante_profiles" ("estado_sigla", "cidade_nome")
    WHERE "verificada" = true
        AND "perfil_visivel" = true
        AND "plano_vigente" IS NOT NULL;
