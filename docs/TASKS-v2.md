# Tasks v2 — Privello (pós T01–T14)

Backlog de funcionalidades novas decidido com o produto. Tudo
**in-site, sem email**. Status:
- ⬜ Pendente · 🟡 Em progresso · ✅ Concluída · ❌ Descartada

> Convenções (mesmas do TASKS.md): server-only em `src/server/`,
> validação dupla Zod + `validar*`, primitivos sem domain leak
> (`lint:primitives`), transações atômicas, rate limit em criação,
> ≥1 teste unit por service novo, JSDoc no topo, 1 task = 1 commit.

---

### ✅ V1 — Toast / Notification global (UI)
**Esforço**: ~2h.
Feedback transitório (sucesso/erro/info) em qualquer tela, hoje
tudo é inline.

- [x] Primitivo `ToastProvider` + `useToast()` + `Toaster` (stack
      animado, auto-dismiss, tons success/danger/info).
- [x] Montar provider no root layout (client).
- [x] Sem domain leak (passa lint).

### ✅ V2 — Notificações in-site (Acompanhante)
**Esforço**: ~6h.
Central de notificações no painel: "X te avaliou", "X te salvou",
"verificação aprovada", "boost ativou". Sininho com contador.
**Sem email** — tudo no site.

- [x] Model `Notification(userId, tipo, payload, lidaEm, criadoEm)`.
- [x] Service: criar/listar/marcar-lida/contar-não-lidas.
- [x] Disparar em: nova avaliação, novo favorito, verificação
      aprovada/rejeitada, boost ativado.
- [x] Endpoint listar + marcar lida.
- [x] Aba/dropdown "Notificações" no painel com badge (sininho no
      TopBar via slot `topTrailing`).

### ✅ V3 — Busca salva + alerta in-site (Cliente)
**Esforço**: ~5h.
Cliente salva uma busca (cidade + filtros). Quando surge perfil
novo que casa, recebe notificação **no site** (reusa V2).

- [x] Model `SavedSearch(clientUserId, filtrosJson, criadoEm)`.
- [x] Service: salvar/listar/excluir busca; matcher novo-perfil.
- [x] Botão "Salvar busca" na `/acompanhantes`.
- [x] Aba "Buscas salvas" no painel do Cliente.
- [x] Quando a Acompanhante publica o perfil, casa contra buscas
      salvas e notifica os Clientes (in-site).

### ❌ V4 — Sidebar desktop nos painéis
**Esforço**: ~3h. **Descartada** — implementada e revertida a
pedido do produto (não curtiu o resultado visual). Painéis seguem
com BottomNav em todas as larguras.

- [x] ~~Primitivo `SideNav` (espelha BottomNav, sem domain leak).~~
- [x] ~~AppShell renderiza SideNav em lg+ e BottomNav em mobile.~~
- Revertido no commit `revert(nav): remove V4 sidebar desktop`.

### ⬜ V5 — Onboarding do Cliente Fan (tour)
**Esforço**: ~2h.
Explicar o que o Fan desbloqueia no primeiro acesso do Cliente.

- [ ] Primitivo `OnboardingTour` / banner dismissível.
- [ ] Persistir "visto" (localStorage ou flag no perfil).
- [ ] Mostrar no painel do Cliente Grátis.

### ⬜ V6 — Compartilhar cidade/bairro (card-imagem)
**Esforço**: ~3h.
Estende o T11: card "X acompanhantes em Blumenau" pra
compartilhar a busca.

- [ ] Endpoint `GET /api/acompanhantes/share-city.png` (sharp).
- [ ] Botão compartilhar na `/acompanhantes`.

### ⬜ V7 — Observabilidade (sem dep paga)
**Esforço**: ~2h.
Logs estruturados + error boundaries. Pronto pra plugar Sentry
depois, mas sem adicionar dependência não-configurada.

- [ ] `lib/observability/logger.ts` (log estruturado JSON).
- [ ] `app/error.tsx` + `app/global-error.tsx` (boundaries).
- [ ] Trocar `console.*` crus por logger nos pontos críticos.

## Status global

- 3 / 7 concluídas.
- Descartado: bloqueio de Cliente (não faz sentido — visitante
  pode estar deslogado). V4 (sidebar desktop) — implementada e
  revertida a pedido do produto.
