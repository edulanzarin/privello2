# Arquitetura — Privello

Visão geral das camadas e integrações da plataforma.

## Stack

- **Next.js 15** (App Router, Server Components por padrão).
- **Prisma** + Postgres.
- **Cloudflare R2** (S3-compatível) para mídia. Em dev, filesystem
  local em `.storage/`.
- **TypeScript** estrito.
- **Tailwind CSS** com tokens centralizados em
  `src/components/tokens.ts`.
- **Argon2id** para senhas (`@node-rs/argon2`).

## Layout do repositório

```
src/
├── app/                      Rotas Next.js (App Router)
│   ├── (public)/             Login, cadastro, onboarding (sem AppShell)
│   ├── (shell)/              Home pública + Acompanhantes + Reels (com AppShell)
│   ├── cliente/              Painel privado de Cliente (com AppShell)
│   ├── acompanhante/         Painel privado de Acompanhante (com AppShell)
│   ├── api/                  Route handlers (REST)
│   ├── globals.css           Tailwind base + utilities
│   └── layout.tsx            Root layout
│
├── components/               UI library
│   ├── primitives/           47 primitivos
│   ├── shell/                navItems builder
│   ├── icons.tsx             Pack autoral (31 ícones)
│   ├── tokens.ts             Design tokens
│   └── index.ts              Barrel público (@/components)
│
├── domain/                   Lógica pura, sem IO
│   ├── plano/                Definições do plano de Acompanhante
│   ├── plano-cliente/        Definições do plano de Cliente
│   ├── aparencia/            Vocabulário visual da Acompanhante
│   ├── validation/           Validadores canônicos (email, senha,
│   │                         foto, mídia, descrição, etc.)
│   └── schemas.ts            Zod schemas reusados por server e UI
│
├── server/                   Lógica de aplicação (acessa banco/R2)
│   ├── auth/                 Sessões, login, logout
│   ├── cadastro-cliente/     Sistema_de_Cadastro_Cliente
│   ├── onboarding/           Sistema_de_Onboarding (Acompanhante)
│   ├── planos/               Plano da Acompanhante
│   ├── planos-cliente/       Plano do Cliente
│   ├── acompanhante-profile/ Resumo de perfil para UI
│   ├── cliente-profile/      Idem
│   ├── localidades/          IBGE + Overpass com cache
│   └── storage/              R2 wrappers (foto perfil + galeria)
│
├── lib/
│   ├── db.ts                 Prisma singleton
│   └── storage/r2.ts         Único ponto de contato com R2
│
└── middleware.ts             Edge: valida HMAC de cookie de sessão
```

## Sistemas

Os sistemas seguem nomenclatura do design (`design.md`):

| Sistema | Implementado | Onde | Status |
|---|---|---|---|
| `Sistema_de_Autenticacao` | Sim | `server/auth/*`, `api/auth/*` | Cookie HMAC, sessão revogável, rate-limit por email. |
| `Sistema_de_Cadastro_Cliente` | Sim | `server/cadastro-cliente/registrar.ts` | Single-page, foto opcional via stage. |
| `Sistema_de_Onboarding` | Sim | `server/onboarding/*` | 7 etapas, draft com TTL 60min, foto staged. |
| `Sistema_de_Planos` (Acompanhante) | Sim | `server/planos/index.ts` | Básico/Premium. Atomicidade transacional. |
| `Sistema_de_Planos_Cliente` | Sim | `server/planos-cliente/index.ts` | Grátis/Fan. Capability flags. |
| `Sistema_de_Foto_de_Perfil` | Sim | `server/storage/{profileMedia,replaceProfilePhoto}.ts` | Stage → commit → R2. Idempotente. |
| `Sistema_de_Midias` (galeria) | Sim | `server/storage/galleryMedia.ts` | Foto + vídeo. Limites por plano. |
| `Sistema_de_Localidades` | Sim | `server/localidades/*` | IBGE + Overpass via Nominatim, cache no Postgres. |
| `Sistema_de_Likes` | Não | — | Schema previsto, frontend pronto via `LikeButton`. |
| `Sistema_de_Comentarios` | Não | — | Schema previsto, frontend pronto via `Comment`/`CommentInput`. |
| `Sistema_de_Avaliacoes` | Não | — | Não iniciado. Só placeholder na aba Atividade. |
| `Sistema_de_Stories` | Não | — | UI placeholder na aba Mídias. |
| `Sistema_de_Audio_de_Apresentacao` | Não | — | UI placeholder na aba Áudio. |
| `Sistema_de_Reels` | Não | — | Página placeholder. |
| `Sistema_de_Edicao_de_Perfil` | Não | — | Sub-rotas `/conta/<campo>` apontadas mas não implementadas. |
| `Sistema_de_Edicao_de_Conta` | Não | — | Idem. |

## Modelos do banco

Resumo dos modelos em `prisma/schema.prisma`:

| Model | Para quê |
|---|---|
| `User` | Identidade base. `email` e `identificador` em caixa baixa, únicos. |
| `ClientProfile` | Perfil de Cliente. `fotoPerfilId`, `planoVigente: GRATIS\|FAN\|null`. |
| `AcompanhanteProfile` | Perfil completo. `fotoPerfilId`, telefone, localização, descrição, 12 campos de aparência (peso/altura/etnia/etc), `planoVigente: BASICO\|PREMIUM\|null`. |
| `Media` | Arquivo em R2. `kind: PHOTO\|VIDEO`, `description?`, `isProfilePhoto`, `status: COMMITTED\|PENDING_REPAIR\|DELETED`. |
| `Session` | Sessão autenticada. `expiresAt`, `revokedAt`, `lastSeenAt`. |
| `LoginAttempt` | Log para rate-limit por email. |
| `OnboardingDraft` | Estado parcial do onboarding. TTL 60min. |
| `IbgeCacheEntry` | Cache local de UFs/cidades/bairros. |

### Migrations aplicadas

- `20250101000000_init` — schema base.
- `20260521000000_client_profile_foto` — `ClientProfile.fotoPerfilId`.
- `20260601000000_acompanhante_aparencia` — 12 campos + bairro.
- `20260615000000_cliente_plano` — `PlanoClienteTipo` + `planoVigente`.
- `20260620000000_galeria_midias` — `MediaKind`, `Media.description`,
  índice composto.

## Fluxos críticos

### Login

```
POST /api/auth/login
  ├─ login() valida email/identificador + senha (argon2id)
  ├─ Cria Session (TTL 30 dias máx)
  ├─ signSessionCookie() assina HMAC-SHA256 → cookie httpOnly
  └─ retorna { userType: 'CLIENTE' | 'ACOMPANHANTE' }
```

Cliente UI redireciona para `/` (Cliente) ou `/acompanhante`
(Acompanhante).

### Logout

```
POST /api/auth/logout
  ├─ verifySessionCookie() lê HMAC
  ├─ logout() = revokeSession() (idempotente)
  └─ Set-Cookie de descarte
```

Frontend (`LogoutButton`) sempre redireciona para `/`.

### Acesso a área autenticada

```
[Edge] middleware.ts
  └─ verifica HMAC do cookie
     └─ injeta x-session-id em headers
     └─ redirect /login se inválido em rota protegida

[Node] cliente/layout.tsx ou acompanhante/layout.tsx
  └─ resolveSession() → confere expiração e revogação no banco
  └─ Verifica userType
  └─ Para Acompanhante: obterVigente() → redireciona para /selecao-plano se null
  └─ Renderiza AppShell
```

### Foto de perfil

```
PROD:
[browser] MediaUploadModal → POST /api/conta/foto (multipart)
[server]  replaceProfilePhoto():
  ├─ stageProfilePhoto() valida MIME/tamanho, putStaged em R2
  ├─ TX: cria Media COMMITTED + atualiza fotoPerfilId + DELETE Media antiga
  └─ commitProfilePhoto() copia + deleta staged em R2 (retry, fallback PENDING_REPAIR)
[browser] router.refresh() → ProfilePhotoEditor re-renderiza com nova foto

DEV:
  putStaged → escreve .storage/staged/<uuid>
  commit    → copia para .storage/committed/<userId>/profile.<ext>
  GET /api/storage/<key> serve o arquivo
```

### Galeria de mídias

Mesmo padrão de foto de perfil, mas:
- `kind` discriminado (PHOTO/VIDEO).
- `description` opcional.
- Limite checado dentro da transação (`SELECT count() WHERE
  ownerId AND !isProfilePhoto AND COMMITTED`).
- Chave final inclui UUID por mídia: `committed/<userId>/galeria/<uuid>.<ext>`.

## Property invariants relevantes

- **P15**: Nada de `staged/` ou `committed/` órfão sobre falhas. Todas
  as funções de storage limpam staged em catch.
- **P29**: Primitivos não conhecem domínio. Validado por
  `scripts/lint-primitives.ts`.
- **P32 / Req 7.7**: Apenas `src/lib/storage/r2.ts` importa AWS SDK.

## Convenções de erro

Endpoints retornam `{ ok: boolean, reason?: string, ...payload }` com
HTTP correto:

- `200` sucesso.
- `400` validação ou shape errado.
- `401` não autenticado.
- `403` autorizado mas tipo errado.
- `409` conflito (limite, duplicidade, estado errado).
- `429` rate-limit.
- `500` falha de persistência.

Cada `reason` é um identificador estável que a UI mapeia para mensagem
amigável (ex.: `MidiasTab.reasonToMessage`).

## Variáveis de ambiente

```
DATABASE_URL=postgresql://...
SESSION_SECRET=...                # HMAC do cookie
R2_ACCOUNT_ID=...                 # Apenas em produção
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
NODE_ENV=development|production   # Em dev, R2 vira filesystem
```

## Comandos comuns

```bash
# Geração e migration (com next dev parado!)
npx prisma generate
npx prisma migrate dev --name <slug>

# Dev
npm run dev

# Lint estrutural de primitivos
npm run lint:primitives

# Type check completo
npx tsc --noEmit
```

> No Windows, `npx prisma generate` falha com EPERM se `next dev`
> estiver rodando (lock no DLL do query engine). Pare o dev, rode
> migrate, reinicie.

## Para ler em seguida

- `docs/COMPONENTS.md` — catálogo completo de primitivos.
- `.kiro/specs/privello-platform/design.md` — design dos sistemas
  (fonte de verdade da nomenclatura).
- `prisma/schema.prisma` — schema canônico.
- `src/components/tokens.ts` — fonte de verdade de cores/tipografia.
