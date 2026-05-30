-- Mapa interativo (T14) — coordenadas aproximadas do perfil.
--
-- `lat`/`lng` guardam o centroide do bairro (ou da cidade quando
-- sem bairro) + um pequeno ruído (jitter), geocodificado via
-- Nominatim ao salvar a localização. NUNCA é endereço exato — o
-- produto é vitrine, não rastreio. O jitter (~algumas centenas de
-- metros) garante que dois perfis do mesmo bairro não fiquem
-- empilhados no mesmo pixel e que ninguém infira endereço real.
--
-- `NULL` quando ainda não geocodificado (perfis antigos; o
-- backfill acontece lazy no próximo save de localização ou via
-- script de migração de dados).

ALTER TABLE "acompanhante_profiles"
    ADD COLUMN "lat" DOUBLE PRECISION NULL,
    ADD COLUMN "lng" DOUBLE PRECISION NULL;

-- Index parcial pra a query do mapa: só perfis visíveis, com plano
-- e já geocodificados entram. Cobre o filtro do BuscaMapa.
CREATE INDEX IF NOT EXISTS "idx_acompanhante_profiles_geo"
    ON "acompanhante_profiles" ("estado_sigla", "cidade_nome")
    WHERE "lat" IS NOT NULL
        AND "lng" IS NOT NULL
        AND "perfil_visivel" = true
        AND "plano_vigente" IS NOT NULL;
