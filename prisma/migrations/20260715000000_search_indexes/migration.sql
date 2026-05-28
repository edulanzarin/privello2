-- Índices que aceleram a busca pública (`/acompanhantes`).
--
-- A query do `buscar()` faz:
--   WHERE perfil_visivel = true
--     AND plano_vigente IS NOT NULL
--     AND (cidade_nome = ? AND estado_sigla = ?)?
--     AND ...
--   ORDER BY boost_until DESC, plano_vigente DESC, views_count DESC,
--     updated_at DESC
--
-- Sem índices em `(estado_sigla, cidade_nome)`, `views_count` e
-- `updated_at`, a busca por cidade vira full scan da tabela inteira.
-- Em escala (10k+ perfis) o tempo de resposta degrada bem rápido.
--
-- Os índices aqui são parciais quando faz sentido — só perfis
-- visíveis com plano vigente entram no índice, encolhendo o
-- tamanho proporcionalmente à fração de perfis ativos.

-- Localização: par cidade+UF é o filtro mais comum da busca.
CREATE INDEX IF NOT EXISTS idx_acompanhante_localizacao
    ON acompanhante_profiles (estado_sigla, cidade_nome)
    WHERE perfil_visivel = true AND plano_vigente IS NOT NULL;

-- Ordenação por popularidade ("populares" e fallback de
-- "relevância"). Filtra dois flags pra manter o índice enxuto.
CREATE INDEX IF NOT EXISTS idx_acompanhante_views_desc
    ON acompanhante_profiles (views_count DESC, updated_at DESC)
    WHERE perfil_visivel = true AND plano_vigente IS NOT NULL;

-- Ordenação por preço (menor/maior). NULLS LAST porque perfis
-- sem preço são deslocados pro fim em ambas as direções.
CREATE INDEX IF NOT EXISTS idx_acompanhante_preco_asc
    ON acompanhante_profiles (valor_hora_cents ASC NULLS LAST, updated_at DESC)
    WHERE perfil_visivel = true AND plano_vigente IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acompanhante_preco_desc
    ON acompanhante_profiles (valor_hora_cents DESC NULLS LAST, updated_at DESC)
    WHERE perfil_visivel = true AND plano_vigente IS NOT NULL;

-- Recentes (ordenação `recentes` da busca + lastmod do sitemap).
CREATE INDEX IF NOT EXISTS idx_acompanhante_updated_desc
    ON acompanhante_profiles (updated_at DESC)
    WHERE perfil_visivel = true AND plano_vigente IS NOT NULL;
