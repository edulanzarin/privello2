# Status — Privello

Última atualização: 31/05/2026.

## TL;DR

- **64 rotas API** (`route.ts`) + 18 páginas + `/robots.txt`,
  `/sitemap.xml`, `/manifest.webmanifest`.
- **94 arquivos** em `src/components/primitives/` validados pelo
  `lint:primitives` (zero domain leak).
- **0 erros** TypeScript em `src/`; `npm run build` passa.
- **42 migrations** Prisma aplicadas; 24 models, 24 enums.
- PWA real (service worker + install prompt), SEO completo
  (metadata, JSON-LD, sitemap dinâmico com landing pages de
  cidade), mapa interativo, notificações in-site, observabilidade.
- Falta só infra real: credenciais MP de produção, email
  transacional (decisão: tudo in-site, nada de email no MVP),
  Sentry plugado no logger já existente.

## Linha do tempo de entregas

Três backlogs concluídos desde o MVP base:

- **TASKS.md (T01–T14)** — favoritos, filtro verificadas, galeria
  drag-drop, completude de perfil, PWA, stories highlights, FAQ
  sonora (TopicAudios, Premium), vídeo de apresentação, boost
  programado, stats avançados (heatmap), card-imagem de
  compartilhamento, mapa interativo por bairro.
  Descartadas: i18n, a11y deep-dive, verificação ao vivo.
- **TASKS-v2.md (V1–V7, 6/7)** — toast global, notificações
  in-site, busca salva + alerta, onboarding tour do Fan, share
  cidade, observabilidade. V4 (sidebar desktop) implementada e
  **revertida** a pedido do produto.
- **TASKS-v3.md (W1–W8, 8/8)** — vistos recentemente, selo "ativa
  hoje", resumo semanal in-site, comparativo de plano, landing
  pages por cidade (SEO), filtro "perto de mim", rate limit
  visível, métricas no admin.
- **Extra** — mapa nacional de cidades na tela de seleção da
  busca (clicar numa cidade filtra).

## O que tem (completo)

### Auth
- Login + logout (HMAC SHA-256, argon2id, rate-limit, CSRF).
- Reset de senha por token hashed (estrutura completa; envio de
  email pendente — decisão de produto: sem email no MVP).
- Exclusão de conta (LGPD) — apaga User + Cascade + R2 best-effort.
- Cookie `__Host-` em produção; senha alterada revoga todas as
  sessões antigas em transação.

### Cadastro / Onboarding
- Cliente single-page + foto opcional.
- Acompanhante 7 etapas com draft de 60min; geocodifica a
  localização (centroide do bairro) ao finalizar.
- Tour do Fan (banner dismissível) no primeiro acesso do Cliente
  Grátis.

### Planos
- Acompanhante: BASICO / PREMIUM (+ Boost pago, imediato ou
  programado). Comparativo Básico×Premium na seleção.
- Cliente: GRATIS / FAN (24h / 7d / 30d, com expiração lazy).

### Mídia
- Foto de perfil + capa + áudio de apresentação (Premium).
- Galeria com limite por plano, drag-drop pra reordenar, marca
  d'água (sharp + ffmpeg).
- Stories 24h + arquivamento + Highlights + likes + views.
- Reels (feed vertical com algoritmo de ranqueamento).
- Vídeo de apresentação (Premium).
- TopicAudios — FAQ sonora por tópico (Premium; gate na leitura
  também, esconde após downgrade).

### Interações
- Likes e comentários em mídia (trigger SQL nos agregados).
- Avaliações (apenas texto) com resposta da Acompanhante.
- Perguntas e respostas (Q&A).
- Favoritos (Cliente salva Acompanhante; count privado pra ela).

### Busca
- Cidade obrigatória + 15 filtros + ordenações
  (relevância/recentes/preço/popular/**proximidade**).
- Mapa por bairro (contagem, clicar filtra) quando há cidade.
- Mapa nacional por cidade na tela de seleção (clicar filtra).
- Filtro "perto de mim" (geolocalização + Haversine).
- Selo "ativa hoje" (presença via `Session.lastSeenAt`).
- Busca salva + alerta in-site quando surge perfil que casa.
- Compartilhar cidade (card-imagem 1080×1920 via sharp).

### Notificações in-site (sem email)
- Central no sininho (TopBar) pra Acompanhante e Cliente.
- Disparos: nova avaliação, novo favorito, verificação
  aprovada/rejeitada, boost ativado, correspondência de busca
  salva, resumo semanal.
- Resumo semanal disparado pelo cron com guarda de cadência 7d.

### Verificação e denúncias
- Verificação de identidade (selfie + documento, expira 180d,
  cleanup rebaixa o selo).
- Denúncias com unique parcial (1 ativa por reporter+target).

### Painel Acompanhante
- Perfil editável (20+ campos), mídias, reels, áudio/vídeo
  (Premium), perguntas (badge), verificação, estatísticas
  (gráfico 30d + heatmap + origem + cliques WhatsApp), métricas
  (views, curtidas, favoritos), configurações.
- Sininho de notificações.

### Painel Cliente
- Perfil, favoritos, atividade, buscas salvas, vistos
  recentemente (histórico local), configurações.
- Sininho de notificações + tour do Fan.

### Painel Admin
- Gate por `User.isAdmin`.
- Visão geral com métricas (pendências + saúde da plataforma).
- Fila de verificações + fila de denúncias.

### Operacional / Observabilidade
- `GET /api/health`: ping no DB.
- `POST /api/cleanup`: GC (sessões, drafts, login attempts,
  password tokens, stories, fans expirados, verificações
  expiradas, boosts agendados, resumos semanais) — Bearer auth.
- Logger estruturado JSON (`lib/observability/logger.ts`) nos
  pontos críticos (webhook MP, cleanup, notifications, watermark).
- `error.tsx` + `global-error.tsx` (boundaries da marca).
- Headers de segurança no `next.config.ts` (CSP, X-Frame-Options,
  Referrer-Policy, Permissions-Policy, HSTS em prod).
- PWA: `manifest.ts` + service worker + install prompt.

### SEO
- Metadata global, JSON-LD (Organization/WebSite/Person/
  BreadcrumbList), `generateMetadata` dinâmico.
- Landing pages por cidade (`/acompanhantes/cidade/[uf]/[cidade]`,
  ISR 1h, top-200 pré-geradas) com canonical e texto SEO.
- `robots.ts` + `sitemap.ts` dinâmicos (estáticas + landing de
  cidade + busca por querystring + perfis visíveis).

## Banco de dados (42 migrations, 24 models)

Modelos principais: User, ClientProfile, AcompanhanteProfile,
Media, MediaLike, MediaComment, StoryView, ReelView, Session,
LoginAttempt, OnboardingDraft, IbgeCacheEntry, BoostPayment,
AcompanhanteReview, AcompanhanteQuestion, PasswordResetToken,
ProfileDailyStat, ProfileHourlyStat, ProfileOriginStat,
Verification, Report, ClientFavorite, **Notification**,
**SavedSearch**.

Triggers SQL: `trg_media_likes_agg`, `trg_media_comments_agg`,
`trg_reviews_agregado`.

Campos de destaque: `AcompanhanteProfile.lat/lng` (centroide
aproximado pro mapa/proximidade), `boostUntil`, `viewsCount`,
`whatsappClicksCount`, `verificada`.

## Segurança

### Implementado ✓
- Argon2id, HMAC-SHA256 no cookie, `__Host-` em produção.
- Rate limit por email (5/15min), reset (3/60min) e por bucket
  em endpoints de criação (`enforceRateLimit` + `LIMITS`).
- Sessões revogáveis, expiração 30d, middleware anti-spoofing.
- CSRF same-origin em todos os handlers de mutação.
- Headers de segurança completos (CSP + worker-src + tiles OSM).
- Validação dupla (Zod + `validar*`), zero PII no perfil público.
- Confinamento: AWS SDK só em `lib/storage/r2.ts`, MP só em
  `lib/payments/mercadopago.ts`.
- EXIF/GPS strip + marca d'água nas mídias.
- Verificação expira 180d; denúncia única por reporter+target.
- Path traversal bloqueado em `/api/storage/`.
- Cleanup token timing-safe; webhook MP valida `type`.
- Localização sempre aproximada (bairro/cidade), nunca endereço.

### Falta (depende de credenciais/decisão)
- Credenciais `R2_*` e Mercado Pago de produção.
- Validar assinatura do webhook MP.
- Plugar Sentry no `logger` (ponto único `emit` já preparado).
- Cloudflare WAF/rate-limit distribuído.
- Email transacional — **fora de escopo**: produto optou por
  tudo in-site (reset de senha hoje retorna `_devToken` em dev).

## Verificação

- ✅ `npx tsc --noEmit` limpo em `src/`.
- ✅ `npm run build` passa.
- ✅ `npm run lint:primitives` (94 arquivos, zero domain leak).
- ✅ 42 migrations aplicadas.
- ⚠️ Suíte de testes: ~248 passam. **9 falham no baseline**
  (pré-existentes, em onboarding/planos/pos-login — erros de tipo
  `Record<string,unknown>` e `NODE_ENV`), **não relacionados** às
  features acima. Candidato a faxina futura.

## Convenções do projeto (resumo)

- Server-only em `src/server/`; validação dupla (Zod + `validar*`).
- Primitivos sem domain leak (`lint:primitives` proíbe `cliente`,
  `acompanhante`, `plano`, `basico`, `premium`).
- Transações atômicas (`db.$transaction`) em side effects.
- Rate limit em endpoints de criação.
- CSS warm via hex+modifier (`[#ec7b5b]/40`).
- 1 task = 1 commit de feature + 1 commit de doc.
- Antes de commit: `npm run build` + `npx tsc --noEmit` +
  `npm run lint:primitives`.

## Backlogs

- `docs/TASKS.md` — T01–T14 (concluído; T12/T13/T15 descartadas).
- `docs/TASKS-v2.md` — V1–V7 (6/7; V4 revertida).
- `docs/TASKS-v3.md` — W1–W8 (8/8).
