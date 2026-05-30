# Prompt de continuação — Privello

Cole o conteúdo abaixo no início de uma nova sessão de chat
para retomar o trabalho sem perder contexto.

---

## INÍCIO DO PROMPT (copie tudo abaixo desta linha)

Estou continuando o desenvolvimento da plataforma **Privello**
(Next.js 15 / Prisma / Postgres / R2 / Mercado Pago). Plataforma
brasileira de Acompanhantes com perfis públicos, planos pagos
(Cliente Fan + Acompanhante Básico/Premium/Boost), busca por
cidade, stories, reels, avaliações, perguntas, verificação de
identidade e denúncias.

### Princípio do produto

- Site é **vitrine + perguntas públicas**.
- Sem DM 1:1, sem reservas/agenda, sem sinal de Pix.
- Contato real é **sempre via WhatsApp** (botão direto).
- Privello não intermedia transação nem responde pelo encontro.

### Estado atual do código

Codebase sólido:
- 295 arquivos `.ts/.tsx`, ~54k linhas.
- 87 primitivos em `src/components/primitives/` com lint estático
  garantindo zero domain leak (`scripts/lint-primitives.ts`).
- 21 modelos Prisma, 30 migrations.
- 0 erros TypeScript em `src/`.
- 0 `any` / `@ts-ignore`.
- Build passa.

Sistemas funcionais:
- Cadastro/login Cliente + onboarding multi-step Acompanhante.
- Perfil público com galeria, áudio, avaliações com rating
  opcional + resposta da Acompanhante, perguntas, stories,
  reels, WhatsApp CTA.
- Plano Cliente Fan (Grátis + 24h/7d/30d) e plano Acompanhante
  (Básico/Premium + Boost pago).
- Busca filtrada por cidade obrigatória + filtros (gênero,
  etnia, faixa de preço, idiomas, etc).
- Stories aggregados por cidade com viewer estilo Instagram
  (sequência por owner).
- Reels com algoritmo (cidade/UF, boost, plano, frescor,
  popularidade, prioridade pra não-vistos).
- Verificação de identidade (selfie + documento, expira em
  180 dias com cleanup automático).
- Sistema de denúncias com unique parcial (1 ativa por
  reporter+target).
- Painel admin mínimo com fila de verificações e denúncias.
- Redesign visual: Poppins, paleta warm (`#ec7b5b` /
  `#c5523a`), glass surfaces reais, halo + textura no
  PageSurface, primitivos como FeatureTile, CityChips,
  HeroCollage, LoadingSpinner, Paginator com 2 variantes.

### Segurança implementada

- Argon2id (memoryCost 19456 KiB, timeCost 2).
- Cookies HMAC SHA-256 via Web Crypto API. `__Host-sessionId`
  em prod.
- CSRF same-origin via `Origin`/`Referer` em todos os route
  handlers.
- CSP completo + X-Frame-Options DENY + Permissions-Policy +
  HSTS em prod (já em `next.config.ts`).
- Open redirect protegido (`sanitizarNext`).
- Rate limit em 9 endpoints de criação (`LIMITS` em
  `rateLimitGuard.ts`).
- EXIF/GPS strip em foto perfil/capa via `sharp` (`stripExif.ts`).
- Verificação tem expiração 180d com cleanup noturno.
- Denúncia única por reporter+target enquanto pendente.
- Path traversal blocked em `/api/storage/`.
- Webhook MP valida `type === "payment"`.
- Token timing-safe em `/api/cleanup`.

### Convenções obrigatórias

1. **Server-only logic** em `src/server/`. Nada de
   acesso direto ao DB de client component.
2. **Validação dupla**: Zod schema + helpers `validar*` em
   `domain/validation/`. Reusar em UI e server.
3. **Primitivos sem domain leak**: nenhum nome de prop ou
   tipo nos primitivos pode conter `cliente`, `acompanhante`,
   `plano`, `basico`, `premium`, `fan`. O lint
   `npm run lint:primitives` valida.
4. **Transações atômicas**: side effects entre tabelas
   sempre em `db.$transaction`.
5. **Rate limit**: endpoints de criação plumbam
   `enforceRateLimit("bucket", userId, LIMITS.bucket)`.
6. **Cookies seguros**: HttpOnly, SameSite=Lax, Secure
   em prod.
7. **CSS warm via hex+modifier**: `[#ec7b5b]/40` em vez de
   `[color:var(--accent)]/40` (Tailwind 3 não processa
   modifier de opacity em CSS var arbitrária — vira ring
   azul default).
8. **`<img>` em primitivos OK** quando URL é dinâmica de R2;
   `next/image` quando estático.

### Comandos do projeto

```bash
npm run dev              # dev server
npm run build            # production build
npx tsc --noEmit         # typecheck
npm run lint:primitives  # lint estático de domain leak
npx vitest --run         # tests
npx prisma migrate dev   # nova migration (precisa shadow DB)
PGPASSWORD=masterkey psql -h localhost -U postgres -d privello -f X.sql
                         # aplicar SQL direto se shadow falhar
npx prisma migrate resolve --applied <name>
                         # marcar migration como aplicada
npx prisma generate      # regenerar client
```

Senha de seed: `Edz#7284`.
Branch atual: `main` (vários commits à frente do `origin/main`,
sem push automático).

### Permissões

- **Pode rodar qualquer comando** sem pedir confirmação.
- **Pode commitar** após cada task completa.
- **Não fazer push** automático — só quando explicitamente
  pedido.

### Tarefas pendentes

Veja `docs/TASKS.md` — 15 tasks priorizadas (T01-T15) com
checklist detalhado e estimativa de esforço. Status global:
0/15 concluídas. Total ~67h.

Atacar **na ordem do TASKS.md**, fazendo 1 task = 1 commit.
Atualizar status (⬜ → 🟡 → ✅) conforme progresso.

### Próxima task

**T01 — Favoritos / Salvos** (~3h)
Cliente marca Acompanhantes como favorita. Lista própria em
`/cliente#favoritos`. Contador no painel da Acompanhante
("X clientes te salvaram"). Detalhes completos no
`docs/TASKS.md`.

### Documentação relevante

- `docs/STATUS.md` — fonte da verdade do estado atual.
- `docs/TASKS.md` — backlog priorizado (foco).
- `docs/AUDIT_2026_05.md` — auditoria de segurança/qualidade
  com itens fechados e remanescentes.
- `docs/ARCHITECTURE.md` — visão geral.
- `docs/COMPONENTS.md` — catálogo dos primitivos.

### Arquivos importantes (referência)

- `src/server/auth/guards.ts` — todos os guards
  (`requireSession`, `requireCliente`, `requireClienteFan`,
  `requireAcompanhante`, `requireAcompanhanteWithPlano`,
  `requireAdmin`, `requireFile`).
- `src/server/auth/rateLimitGuard.ts` — `enforceRateLimit` +
  `LIMITS`.
- `src/server/storage/profileMedia.ts` — pattern de upload
  staged → commit (transação atômica).
- `src/server/storage/replaceUserMediaSlot.ts` — helper
  genérico de "trocar slot de mídia".
- `src/components/index.ts` — barrel dos 87 primitivos.
- `prisma/schema.prisma` — 21 models + enums.

### Como começar

1. Leia `docs/TASKS.md` integralmente.
2. Pegue **T01 — Favoritos**. Marque como 🟡 (em progresso) no
   `TASKS.md`.
3. Execute o checklist ponto a ponto.
4. Faça `npm run build` + `npx tsc --noEmit` +
   `npm run lint:primitives` antes do commit.
5. `git commit -m "feat(favoritos): ..."`.
6. Marque T01 como ✅ no TASKS.md, commit do doc separado.
7. Reporta o que fez e qual a próxima task pegando.

### Comportamento esperado

- **Não pedir confirmação** pra cada comando.
- **Não interromper** depois de cada arquivo — execute o
  checklist completo da task antes de retornar resposta.
- **Comunicar em pt-BR**, tom direto e conciso.
- **Reportar** ao final: arquivos criados/modificados, build
  status, próxima task.

Pode começar pela T01.

## FIM DO PROMPT
