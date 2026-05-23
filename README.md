# Privello

Plataforma de Acompanhantes e Clientes. Next.js 15, Prisma, Cloudflare R2.

## Documentação

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — visão geral de
  stack, fluxos críticos, modelos do banco, convenções de erro.
- [`docs/COMPONENTS.md`](./docs/COMPONENTS.md) — catálogo da
  Biblioteca de Componentes (47 primitivos, padrões de uso, ícones).
- [`.kiro/specs/privello-platform/design.md`](./.kiro/specs/privello-platform/design.md) —
  design canônico dos sistemas (fonte de verdade da nomenclatura).

## Comandos

```bash
npm install
cp .env.example .env            # preencha SESSION_SECRET, DATABASE_URL, R2_*
npx prisma generate
npx prisma migrate dev
npm run dev

# Lint estrutural dos primitivos (proíbe vazamento de domínio)
npm run lint:primitives

# Type check
npx tsc --noEmit
```

## Estrutura

```
src/
├── app/         Rotas Next (App Router)
├── components/  Biblioteca de Componentes (primitivos + barrel)
├── domain/      Lógica pura, sem IO
├── server/      Lógica de aplicação (acessa banco e R2)
├── lib/         Wrappers de infra (Prisma, R2)
└── middleware.ts
```

Detalhes em [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
