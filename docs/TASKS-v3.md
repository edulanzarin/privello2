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

### ⬜ W2 — Ativa recentemente (presença)
Badge de atividade nos cards/perfil baseado em `Session.lastSeenAt`.
- [ ] Service `obterAtividadeRecente(userIds)` (max lastSeenAt).
- [ ] Campo `ativaRecentemente` no FeedItem (busca + feed).
- [ ] Badge "Ativa hoje" em card e perfil. Granularidade grossa.

### ⬜ W3 — Resumo semanal in-site (Acompanhante)
Notificação "essa semana: X visitas, Y curtidas". Reusa V2.
- [ ] Enum `RESUMO_SEMANAL` + payload.
- [ ] `enviarResumosSemanais` no cron, com guarda de cadência 7d.
- [ ] Render no sininho.

### ⬜ W4 — Comparativo de plano contextual
Diff Básico vs Premium em vez de só bloquear.
- [ ] Primitivo `PlanComparison` (genérico, sem domain leak).
- [ ] Usar na seleção de plano da Acompanhante.

### ⬜ W5 — Landing pages por cidade (SEO)
`/acompanhantes/cidade/[uf]/[cidade]` ISR.
- [ ] Helper de slug de cidade (normalizar/resolver).
- [ ] Página ISR com lista + texto SEO + metadata.
- [ ] Incluir no sitemap.

### ⬜ W6 — Filtro "perto de você"
Ordenação por proximidade usando lat/lng + geolocalização.
- [ ] Busca aceita `viewerLat/viewerLng` + ordenar=proximidade.
- [ ] Botão "Perto de mim" na busca (geolocation).

### ⬜ W7 — Rate limit visível
Feedback (toast) quando o Cliente bate limite (429).
- [ ] Helper client pra tratar 429 com toast.
- [ ] Aplicar nos fluxos de criação (review, pergunta, favorito).

### ⬜ W8 — Painel admin: métricas rápidas
Visão geral com contadores no admin.
- [ ] `obterMetricasAdmin()` (pendências + totais).
- [ ] Aba/seção "Visão geral" no admin.

## Status global
- 1 / 8 concluídas.
