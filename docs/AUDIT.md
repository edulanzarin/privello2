# Histórico de Auditoria — Privello

Documento de histórico das auditorias e iterações. Para o estado
atual da plataforma (resumo executivo, sistemas, rotas), veja
[`STATUS.md`](./STATUS.md).

## Linha do tempo

### 26/05/2026 — Auditoria inicial

Levantamento completo do projeto: arquitetura, primitivos,
componentes, rotas, segurança. Identificou 6 itens críticos e
15+ desejáveis.

**Críticos (na época):**

1. Triggers SQL ausentes — **falso positivo**: já existiam.
2. Validar webhook MP — não fizemos (depende de credenciais).
3. Busca/listagem de Acompanhantes — placeholder.
4. Edição de perfil — InfoRows apontavam pra rotas inexistentes.
5. CSRF nos route handlers REST — Server Actions têm proteção
   nativa, mas REST não.
6. Health check pra Railway.

### 26/05/2026 — Passe 1 (CSRF + Health + Busca + Stories básico)

- ✓ `GET /api/health` com DB ping (200/503).
- ✓ CSRF same-origin via `Origin`/`Referer`
  (`server/auth/csrf.ts`), integrado em todos os guards.
- ✓ Busca completa em `/acompanhantes`: 14 filtros, 5 ordenações,
  paginação numerada. Novos primitivos `FilterPanel` e
  `FilterSection`.
- ✓ Stories: schema (`MediaRole.STORY` + `expiresAt`), backend
  (`storyMedia.ts`), endpoints. UI primeira tentativa.
- ✓ Edição de perfil — confirmado que já existia em
  `EditarPerfilModal`.

### 26/05/2026 — Passe 2 (sem rating + Q&A)

- ✓ Removida nota numérica de avaliações por opção de UX.
  - Migration: drop `acompanhante_reviews.rating` +
    `acompanhante_profiles.reviews_average`.
  - `comment` virou NOT NULL.
  - Trigger `recalcular_reviews_agregado` redefinida.
  - Removido primitivo `RatingStars`.
- ✓ Sistema de Perguntas e Respostas (Q&A).
  - Tabela `acompanhante_questions` (pergunta + resposta opcional
    na mesma linha).
  - Backend: `criarPergunta`, `responderPergunta`,
    `removerResposta`, `excluirPergunta`,
    `listarPerguntasPublicas`, `contarPerguntasPendentes`.
  - Endpoints: `POST /api/acompanhantes/[slug]/questions`,
    `POST /api/questions/[id]`, `DELETE /api/questions/[id]`.
  - UI: `PerguntasSection` (perfil público, antes das
    avaliações), `PerguntasTab` (painel da Acompanhante com
    badge de pendentes).
- ✓ Curtidas totais reais no painel + perfil
  (`contarLikesTotais` agregando `_sum(likesCount)` de todas as
  mídias do usuário).

### 26/05/2026 — Passe 3 (Stories iteração 1: ring + viewer próprio)

- ✓ Schema: `MediaStatus.ARCHIVED` (stories expiram pra ARCHIVED,
  não DELETED — preserva curtidas no histórico).
- ✓ Tabela `story_views` (1 por par media+user).
- ✓ Caption nos stories (até 80 chars).
- ✓ Avatar com `storyRing` (unseen/seen/none).
- ✓ Tentativa: primitivo `StoryViewer` full-screen vertical.
- ✗ Foi descartado na iteração seguinte por estar "horrível".

### 26/05/2026 — Passe 4 (Stories iteração 2: MediaCarousel + hideComments)

- ✓ Removidos `StoryViewer` e `StoryAvatar`.
- ✓ MediaCarousel ganhou `hideComments` — same UI da galeria,
  só sem comentário.
- ✗ Visualmente o painel branco da direita ficava esquisito pra
  Stories.

### 26/05/2026 — Passe 5 (Stories iteração 3: storyMode no MediaCarousel)

- ✓ MediaCarousel ganhou `storyMode` que é layout vertical:
  mídia em cima, info embaixo (mesma aparência da galeria mas
  stacked sempre).
- ✓ Auto-advance simplificado: `setTimeout(storyAutoAdvanceMs)`
  para fotos, `onEnded` para vídeos.
- ✓ Progress bar com CSS animation (`@keyframes
  story-progress-bar` em `globals.css`) — independente do React
  re-render, sem warning de `setState during render`.
- ✓ Avatar ring com `border + padding` (mais robusto que
  `ring + ring-offset` que tinha problemas de pintura).

## Estado final pós-iterações

Veja [`STATUS.md`](./STATUS.md) — documento atualizado com
todos os sistemas, rotas, endpoints e o que ainda falta.

### 31/05/2026 — Auditoria de design + polish

Sub-agente fez varredura de design. Itens fechados nesta rodada:

- ✓ **Cor `accent` registrada no Tailwind**
  (`DEFAULT`/`deep`/`soft`), espelhando as CSS vars `--accent*`.
  Habilita utilitários `accent/40`, `bg-accent-soft` etc. no
  lugar de hex arbitrário `[#ec7b5b]/40`. A migração dos ~68
  arquivos legados fica opcional/incremental (não em massa).
- ✓ **BottomNav** com `focus-visible:ring` nos links (a11y de
  teclado).
- ✓ **AvaliacoesSection** usa o primitivo `EmptyState` no estado
  vazio (antes era bloco cru dentro de `Card`).
- ✓ **layout.tsx**: const da fonte renomeada `geist` → `poppins`
  (carrega Poppins). Var CSS `--font-inter` mantida intacta pra
  não quebrar o tailwind config.

Itens mapeados e **adiados** (maiores, exigem confirmação): migrar
fluxos pós-ação de `InlineAlert` → toast; remover primitivos
órfãos (`PricingTag`, `StatTile`, `LoadingSpinner`); consolidar
variantes de stat/badge.

## Lições

1. **Reusar primitivos é mais robusto que criar novos.** O
   `StoryViewer` próprio foi removido — `MediaCarousel` com
   `storyMode` é mais simples e mantém comportamento consistente.

2. **CSS animation > setState para progress bars.** Evita o bug
   do `setState during render` e dá uma performance melhor
   (GPU-accelerated).

3. **Border + padding > ring + ring-offset arbitrários.** Border
   sempre renderiza; ring pode ser cortado por
   `overflow-hidden` em ancestrais.

4. **Triggers no banco economizam código.** `likes_count`,
   `comments_count`, `reviews_count` ficam consistentes sem que
   a aplicação precise lembrar de atualizar.

5. **CSRF same-origin é suficiente pra MVPs.** Não precisa
   tabela de tokens — comparação `Origin` vs `host` cobre o caso
   de uso real.

6. **`queueMicrotask` resolve setState durante eventos.** Quando
   o callback de um listener (ex.: `onEnded` de vídeo) precisa
   atualizar state em outro componente, deferir um tick evita o
   warning do React.
