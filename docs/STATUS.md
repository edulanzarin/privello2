# Status — Privello

Última atualização: 28/05/2026.

## TL;DR

- **49 rotas** compilando + `/robots.txt`, `/sitemap.xml`,
  `/manifest.webmanifest`.
- **78 primitivos** em `src/components/primitives/` (zero domain leak).
- **0 erros** TypeScript em `src/`.
- **20 migrations** Prisma aplicadas (incluindo índices da busca).
- SEO completo: metadata global, JSON-LD em home/perfil, sitemap
  e robots dinâmicos, generateMetadata dinâmico nas páginas
  principais.
- Sistemas críticos todos prontos. Falta só infra real (credenciais
  MP, email transacional, monitoramento) e features pós-MVP (Reels,
  painel admin).

## Última rodada de hardening (28/05)

- Rate limit por IP em `/api/check-availability` (30/min) com
  `clientKeyFromRequest` extraído de cabeçalhos do reverso.
- `/api/conta/senha` revoga **todas** as sessões antigas em
  transação atomicamente (preserva só a atual).
- Índices SQL parciais pra busca:
  `(estado_sigla, cidade_nome)`, `views_count DESC`,
  `valor_hora_cents` (asc/desc), `updated_at DESC` — todos
  `WHERE perfil_visivel = true AND plano_vigente IS NOT NULL`.
- `_devToken` no reset de senha agora exige
  `NEXT_PUBLIC_SITE_URL` apontando pra localhost (dupla checagem
  contra staging com `NODE_ENV` errado).
- Webhook MP só processa quando `type === "payment"` ou
  `topic === "payment"` ou `action.startsWith("payment.")` —
  recusa `merchant_order` e similares.
- Cookie de cooldown de view consolidado em **1 cookie único**
  (`pv`) com map base64-JSON e cap em 200 entries com LRU drop.
  Antes era 1 cookie por perfil — power users explodiam a cota
  do navegador.
- `toggleLike` só ajusta stat diário quando a mutação realmente
  alterou o banco (idempotência sem inflar contador).
- `incrementarStatDiaria` clampa em zero pra decremento — nunca
  vira negativo.
- `obterStatsHome` usa `groupBy + count(_all)` em vez de
  `findMany distinct` — é uma agregação SQL pura agora.
- `obterStoryRingState` removido — `listarStoriesAtivosDoPerfil`
  já entrega `viewed` por item, calculamos o ring em memória sem
  query extra.
- Cleanup token comparado em tempo constante (`timingSafeEqual`).
- 3× `window.confirm` substituídos por `ConfirmDialog`
  (PerguntasTab, PerguntasSection, AvaliacoesSection).
- JSON-LD `Person` removeu `review` malformado (não tinha
  `author`/`reviewBody` real — Google rejeitaria). `aggregateRating`
  já estava ausente desde a remoção da nota numérica.
- `BarChart.formatXLabel` opcional — `EstatisticasTab` extrai dia
  do mês corretamente (cobre virada de mês).
- Ícone `CrownIcon` no badge Premium do painel da Acompanhante
  (consistente com perfil público).

## O que tem (completo)

### Auth
- Login + logout (HMAC, argon2id, rate-limit, CSRF).
- Reset de senha por token (estrutura completa, falta envio de
  email).
- Exclusão de conta (LGPD) — apaga User + Cascade + R2 best-effort.
- Cookie `__Host-` em produção (mais seguro contra subdomain
  takeover).
- Senha alterada → revoga todas as sessões ativas.

### Cadastro / Onboarding
- Cliente single-page + foto opcional.
- Acompanhante 7 etapas com draft de 60min.

### Planos
- Acompanhante: BASICO / PREMIUM.
- Cliente: GRATIS / FAN.

### Mídia
- Foto de perfil + capa + áudio (Premium).
- Galeria com limite por plano + marca d'água (sharp + ffmpeg).
- Stories com 24h + arquivamento + likes + visualizações.

### Interações
- Likes em mídia (1 por par, trigger SQL).
- Comentários em mídia.
- Avaliações (apenas texto, sem nota).
- Perguntas e respostas (Q&A).

### Boost
- Compra via Mercado Pago (estrutura pronta, faltam credenciais).
- Webhook idempotente.

### Busca
- 14 filtros + 5 ordenações + paginação numerada.

### Painel Acompanhante
- Perfil completo editável (20+ campos).
- Mídias (galeria + stories).
- Perguntas com badge de pendentes.
- **Estatísticas**: gráfico de visualizações + curtidas dos
  últimos 30 dias.
- Áudio (Premium).
- Configurações: senha, visibilidade, plano, boost,
  **excluir conta** (zona de risco).

### Painel Cliente
- Perfil editável (nome).
- Atividade: avaliações + curtidas + comentários (filtros).
- Configurações: senha, plano, **excluir conta**.

### Operacional
- `GET /api/health`: ping no DB.
- `POST /api/cleanup`: garbage collection (sessões, drafts,
  login attempts, password tokens, stories arquivar) — protegido
  por `Bearer CLEANUP_TOKEN`.
- Headers de segurança no `next.config.ts` (CSP, X-Frame-Options,
  Referrer-Policy, Permissions-Policy, HSTS em prod).
- Triggers SQL para agregados (`likes_count`, `comments_count`,
  `reviews_count`).
- Loading states (`loading.tsx`) com Skeleton em todas as rotas
  principais.

### SEO
- Metadata global em `src/app/layout.tsx` com `metadataBase`,
  `title.template`, `description`, OG, Twitter, robots, viewport.
- JSON-LD `Organization` no body root.
- JSON-LD `WebSite` + `SearchAction` na home.
- `generateMetadata` dinâmico em `/acompanhantes` — title já vira
  `Acompanhantes em Blumenau, SC` quando filtrado por cidade.
- Metadata do perfil público com canonical, OG image absoluta,
  `noindex` em HIDDEN.
- JSON-LD `Person` + `BreadcrumbList` no perfil público.
- `src/app/robots.ts` — bloqueia `/api/`, painéis privados,
  fluxos de auth; em dev bloqueia tudo.
- `src/app/sitemap.ts` — estáticas + pares (cidade, UF) distintos
  + perfis visíveis com `lastModified` e `priority`.
- `src/app/manifest.ts` — PWA-ready (sem service worker ainda).

## Endpoints API (49)

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password` — gera token (email NÃO
  enviado ainda; em dev retorna `_devToken`)
- `POST /api/auth/reset-password` — consome token + nova senha

### Conta
- `POST /api/conta/foto` — troca foto de perfil
- `POST /api/conta/capa` — troca capa (Acompanhante)
- `POST /api/conta/perfil` — patch parcial
- `POST /api/conta/senha` — troca senha
- `DELETE /api/conta` — **exclui conta** (LGPD)

### Acompanhante
- `POST /api/acompanhante/midias` + `DELETE [id]`
- `POST /api/acompanhante/audio` + `DELETE`
- `POST /api/acompanhante/stories` + `DELETE [id]`
- `PATCH /api/acompanhante/visibilidade`
- `POST /api/acompanhante/boost/checkout`

### Acompanhantes públicos
- `POST /api/acompanhantes/[slug]/view`
- `POST /api/acompanhantes/[slug]/reviews` + `DELETE`
- `POST /api/acompanhantes/[slug]/questions`

### Q&A
- `POST /api/questions/[id]`
- `DELETE /api/questions/[id]`

### Mídia
- `POST /api/medias/[id]/likes`
- `GET /api/medias/[id]/comments`
- `POST /api/medias/[id]/comments`
- `DELETE /api/medias/[id]/comments/[commentId]`

### Stories
- `POST /api/stories/[id]/view`

### Pagamentos
- `POST /api/payments/mp/webhook` (+GET legacy)

### Localidades
- `GET /api/localidades/{estados,cidades,bairros}`

### Storage
- `GET /api/storage/[...key]`

### Operacional
- `GET /api/health` — DB ping
- `POST /api/cleanup` — GC (Bearer auth)

### Cadastro / Check
- `POST /api/cadastro/cliente/foto`
- `GET /api/check-availability`

## Páginas (públicas + privadas)

- `/`, `/acompanhantes` (busca), `/acompanhantes/[slug]`, `/reels`
  (placeholder).
- `/login`, `/cadastro`, `/cadastro/cliente`,
  `/cadastro/acompanhante/[step]`.
- `/recuperar-senha`, `/redefinir-senha?token=`.
- `/cliente`, `/cliente/selecao-plano`.
- `/acompanhante`, `/acompanhante/selecao-plano`,
  `/acompanhante/boost`.

## Componentes (Biblioteca de Primitivos — 76)

Lint `scripts/lint-primitives.ts` proíbe os tokens `cliente`,
`acompanhante`, `plano`, `basico`, `premium` em qualquer arquivo
de `primitives/`.

Adicionados na última rodada:
- `Skeleton` (shimmer animation pra loading).
- `BarChart` (CSS-only, pra gráfico de stats).

## Banco de dados (19 migrations)

Modelos: User, ClientProfile, AcompanhanteProfile, Media,
MediaLike, MediaComment, StoryView, Session, LoginAttempt,
OnboardingDraft, IbgeCacheEntry, BoostPayment,
AcompanhanteReview, AcompanhanteQuestion, **PasswordResetToken**,
**ProfileDailyStat**.

Triggers: `trg_media_likes_agg`, `trg_media_comments_agg`,
`trg_reviews_agregado`.

## Segurança

### Implementado ✓
- Argon2id para senhas
- HMAC-SHA256 no cookie (Edge-safe)
- Cookie **`__Host-` em produção**
- Rate limit por email (5 falhas/15min) e por reset (3/60min)
- Sessões revogáveis com expiração de 30 dias máx
- Middleware anti-spoofing
- CSRF same-origin (em todos os route handlers POST/PATCH/DELETE)
- **Headers de segurança** no `next.config.ts` (CSP,
  X-Frame-Options, Referrer-Policy, Permissions-Policy,
  HSTS em prod)
- Validação Zod em todos os inputs
- Nenhum PII vaza no perfil público
- Confinamento: AWS SDK só em `lib/storage/r2.ts`,
  Mercado Pago só em `lib/payments/mercadopago.ts`
- Marca d'água nas mídias
- Reset de senha com token hashed (SHA-256)
- Senha alterada → todas as sessões antigas são revogadas
- Garbage collection de tabelas que crescem (sessões, drafts,
  login attempts, password tokens, stories)

### Falta (depende de credenciais reais)
- Validar assinatura do webhook MP
- Configurar `R2_*` reais
- Configurar provedor de email (SendGrid/Resend/SES) e plugar
  em `criarTokenResetSenha`
- Sentry / monitoramento
- Cloudflare WAF/rate-limit por IP

## Configuração

`.env` opcional:
- `CLEANUP_TOKEN`: pra ativar `POST /api/cleanup`. Em dev pode
  deixar vazio (endpoint responde 503).

Cron sugerido (Railway / GitHub Actions / cron-job.org):

```bash
# A cada hora — limpeza
curl -X POST -H "Authorization: Bearer $CLEANUP_TOKEN" \
     https://app.example.com/api/cleanup
```

## O que ainda falta

### Pós-MVP (sem urgência)
- **Reels** — feed vertical de vídeos curtos
- **Painel admin** — moderação, métricas globais
- **Sistema de denúncias**
- **Toast/Notification global** (hoje feedback é inline)
- **Sidebar desktop** nos painéis privados
- **PWA manifest + service worker**
- **i18n** (hoje só pt-BR)
- **Pre-commit hooks** (husky + lint-staged + prettier)

### Depende de credenciais
- Validação webhook MP
- Email transacional (SendGrid/Resend/SES)
- Configuração final R2
- Monitoramento (Sentry)

## Verificação

- ✅ `npx tsc --noEmit` limpo em `src/`
- ✅ `npm run build` passa
- ✅ `npm run lint:primitives` (76 arquivos)
- ✅ 19 migrations aplicadas
