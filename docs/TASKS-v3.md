# Tasks v3 — Privello (pós backlog v2)

Próximo conjunto de melhorias. Mesmas convenções: server-only em
`src/server/`, validação dupla, primitivos sem domain leak
(`lint:primitives`), transações atômicas, rate limit em criação,
≥1 teste unit por service novo, JSDoc no topo, 1 task = 1 commit.

Status: ⬜ Pendente · 🟡 Em progresso · ✅ Concluída · ❌ Descartada

---

### ✅ W1 — Vistos recentemente (Cliente)
Histórico dos últimos perfis abertos. Rail no painel do Cliente.
- [x] `lib/recentlyViewed.ts` (localStorage, cap 12, dedupe, hook).
- [x] `TrackVisto` registra ao abrir um perfil público.
- [x] Rail "Vistos recentemente" no painel do Cliente.

### ✅ W2 — Ativa recentemente (presença)
Badge de atividade nos cards/perfil baseado em `Session.lastSeenAt`.
- [x] Service `obterAtividadeRecente(userIds)` (groupBy, janela 24h).
- [x] Campo `ativaRecentemente` no FeedItem (busca + feed home).
- [x] Selo "Ativa hoje" no card (prop genérica `active` no primitivo).

### ✅ W3 — Resumo semanal in-site (Acompanhante)
Notificação "essa semana: X visitas, Y curtidas". Reusa V2.
- [x] Enum `RESUMO_SEMANAL` + payload (migration).
- [x] `enviarResumosSemanais` no cron, guarda de cadência 7d.
- [x] Render no sininho (só envia se houve atividade).

### ✅ W4 — Comparativo de plano contextual
Diff Básico vs Premium em vez de só bloquear.
- [x] Primitivo `PlanComparison` (tabela N×M genérica, sem domain leak).
- [x] Usar na seleção de plano da Acompanhante (linhas derivadas
      do catálogo `PLANO_DEFINITIONS`).

### ✅ W5 — Landing pages por cidade (SEO)
`/acompanhantes/cidade/[uf]/[cidade]` ISR.
- [x] Helper de slug de cidade (`domain/busca/citySlug.ts`).
- [x] Página ISR (revalidate 1h) com lista + texto SEO + metadata
      canônica; `generateStaticParams` pré-gera as top 200.
- [x] Incluído no sitemap (landing + busca querystring).

### ✅ W6 — Filtro "perto de você"
Ordenação por proximidade usando lat/lng + geolocalização.
- [x] Busca aceita `viewerLat/viewerLng` + `ordenar=proximidade`
      (Haversine em memória, exclui sem geo, cap 300 candidatos).
- [x] Botão "Perto de mim" na busca (geolocation + navega com
      lat/lng; paginação preserva coords).

### ✅ W7 — Rate limit visível
Feedback (toast/inline) quando o Cliente bate limite (429).
- [x] Helper client `useRateLimitToast` (toast com tempo de espera).
- [x] Aplicado: favoritar (toast), avaliar e perguntar (inline
      com mensagem de espera).

### ✅ W8 — Painel admin: métricas rápidas
Visão geral com contadores no admin.
- [x] `obterMetricasAdmin()` (pendências + totais de plataforma).
- [x] Aba "Visão geral" (default) no admin com cartões de métrica.

## Status global
- 8 / 8 concluídas.
