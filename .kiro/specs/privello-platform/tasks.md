# Implementation Plan: Privello Platform

## Overview

Plano de implementação do MVP da Privello em Next.js 15 (App Router) + TypeScript, PostgreSQL via Prisma, Cloudflare R2 e Docker. Os passos avançam em camadas: primeiro infraestrutura (projeto, banco, env), depois domínio puro (validação, plano, hash), depois serviços de aplicação (auth, cadastro, localidades, plano, onboarding), depois UI (Biblioteca_de_Componentes e páginas), depois middleware e testes de integração ponta a ponta.

Cada Correctness Property do design vira uma sub-task de teste opcional posicionada o mais perto possível do código que ela valida, para que falhas apareçam cedo. Sub-tasks com `*` são opcionais (testes) e não bloqueiam o fluxo principal.

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Tasks

- [x] 1. Set up project structure, infrastructure and testing tooling
  - [x] 1.1 Initialize Next.js 15 + TypeScript + Tailwind project
    - Criar `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, scripts `dev`/`build`/`start`/`lint`/`test`
    - Estrutura de pastas conforme design (`src/app`, `src/components`, `src/domain`, `src/server`, `src/lib`, `tests/{unit,property,integration}`)
    - _Requirements: 7.1, 7.6_

  - [x] 1.2 Define complete Prisma schema and initial migration
    - Modelos `User`, `ClientProfile`, `AcompanhanteProfile`, `Session`, `LoginAttempt`, `Media`, `OnboardingDraft`, `IbgeCacheEntry` conforme design
    - Enums `UserType`, `PlanoTipo`, `MediaStatus`
    - Índices em `Session(expiresAt)`, `LoginAttempt(email, createdAt)`, `OnboardingDraft(expiresAt)`
    - `prisma generate` + migração inicial; cliente Prisma exportado em `src/lib/db.ts`
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 2.2, 3.1, 3.5, 4.5, 5.4, 5.6, 5.7_

  - [x] 1.3 Create Dockerfile and docker-compose for local dev
    - `docker/Dockerfile` multi-stage (deps → build → runtime) que executa `prisma migrate deploy` e `next start` na porta configurável por `PORT`
    - `docker/docker-compose.yml` com serviço `app` e `db` (PostgreSQL 16) e volume persistente `privello_pgdata`
    - Mesmo Dockerfile utilizável no Railway
    - _Requirements: 7.1, 7.2, 7.6_

  - [x] 1.4 Implement environment validation in lib/env.ts and check-env script
    - Schema Zod listando todas as variáveis (DATABASE_URL, SESSION_SECRET, PORT, R2_*, MP_*, IBGE_*)
    - Função `validateEnv()` chamada na inicialização (antes de aceitar requisições)
    - `scripts/check-env.js` que aborta com `process.exit(1)` listando todas as variáveis ausentes
    - _Requirements: 7.3, 7.5, 7.7, 7.8_

  - [x] 1.5 Create .env.example and update .gitignore
    - `.env.example` com exatamente o conjunto de chaves esperadas pelo schema, com placeholders não sensíveis
    - `.gitignore` cobre `.env` e `.env.local`
    - _Requirements: 7.3, 7.4_

  - [x] 1.6 Set up Vitest, fast-check, testing utilities and shared property generators
    - Configurar Vitest com `--run` em CI, `@testing-library/react`, `msw`, `fast-check`
    - `tests/property/generators.ts` com `validNomeArb`, `validEmailArb`, `validIdentificadorArb`, `validSenhaArb`, `validTelefoneArb`, `invalid*Arb`, `cadastroClienteInputArb`, `onboardingDataArb`, `planoTipoArb`, `cacheStateArb`, `ibgeBehaviorArb`
    - Helper de banco de testes (rollback por suíte) e stub para R2
    - _Requirements: (suporta todos os requisitos via testes)_

  - [x] 1.7 Write property test for environment example/schema parity
    - **Property 30: `.env.example` é o conjunto exato de variáveis lidas em runtime**
    - **Validates: Requirements 7.4**
    - Parsear `.env.example` e o schema Zod de `lib/env.ts`; comparar conjuntos de chaves; falhar se houver diferença

  - [x] 1.8 Write property test for missing env failure
    - **Property 31: Falha de variáveis obrigatórias é determinística e completa**
    - **Validates: Requirements 7.5**
    - Para subconjuntos não-vazios de variáveis obrigatórias, executar `validateEnv` e verificar que a mensagem de erro nomeia exatamente as ausentes e o exit code é diferente de zero

- [x] 2. Implement domain validation primitives
  - [x] 2.1 Implement domain validation functions in src/domain
    - `validarNome` (2..100 trim), `validarEmail` (5..254 + regex parte_local@dominio.tld), `validarIdentificadorFormato` (`^[A-Za-z0-9_]{3,30}$`) e helper de normalização para lower-case, `validarSenha` (8..128), `validarTelefone` (10–11 dígitos após remover `+ ( ) - espaço`), `validarDescricao` (1..1000), `validarFotoPerfil` (mime ∈ {jpeg,png,webp}, tamanho ≤ 10 MB)
    - Schemas Zod reutilizáveis (`cadastroClienteSchema`, `onboardingDataSchema`)
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.7, 3.8, 3.9, 3.10, 3.12_

  - [x] 2.2 Write property test for cadastro Cliente field validation
    - **Property 6: Validação de campos do cadastro de Cliente**
    - **Validates: Requirements 2.1, 2.5, 2.6, 2.7, 2.8, 2.9**

  - [x] 2.3 Write property test for telefone validation
    - **Property 10: Validação do telefone brasileiro**
    - **Validates: Requirements 3.8**

  - [x] 2.4 Write property test for descrição validation
    - **Property 11: Validação da descrição**
    - **Validates: Requirements 3.9**

  - [x] 2.5 Write property test for foto perfil validation
    - **Property 12: Validação da Foto_de_Perfil**
    - **Validates: Requirements 3.10**

- [x] 3. Implement Biblioteca_de_Componentes
  - [x] 3.1 Define design tokens (cores, tipografia, espaçamento)

    - `src/components/tokens.ts` exporta paleta, tipografia e escala de espaçamento
    - `tailwind.config.ts` consome esses tokens (mapeamento de `theme.extend`)
    - _Requirements: 6.6_

  - [x] 3.2 Implement Button, Input, Select, Card primitives
    - Cada componente em `src/components/primitives/{Button,Input,Select,Card}.tsx`
    - Props tipadas com TypeScript e JSDoc por prop pública
    - Estados: `disabled` em todos, `loading` em Button (`aria-busy`), `error`/`errorMessage` em Input e Select (`aria-invalid` + mensagem acessível)
    - Sem props com nomes de domínio (cliente, acompanhante, plano, basico, premium)
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

  - [x] 3.3 Create components barrel export and lint script
    - `src/components/index.ts` re-exporta primitives
    - Script de lint (`scripts/lint-primitives.ts` ou regra ESLint custom) verifica nomes de props proibidos em `src/components/primitives/*`
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 3.4 Write property test for primitive DOM state reflection
    - **Property 28: Componentes primitivos refletem props de estado em atributos DOM**
    - **Validates: Requirements 6.4**
    - Usar `@testing-library/react` para combinações de props `disabled`/`loading`/`error`

  - [x] 3.5 Write property test for primitives domain leakage
    - **Property 29: Componentes primitivos não vazam nomes do domínio**
    - **Validates: Requirements 6.5**
    - Parsear ASTs de `src/components/primitives/*` e checar substrings proibidas em nomes de props

- [x] 4. Implement Sistema_de_Autenticacao
  - [x] 4.1 Implement password hashing service (argon2id)
    - `src/domain/auth/password.ts` com `hashPassword`/`verifyPassword` usando `argon2id` (memoryCost=19456, timeCost=2, parallelism=1)
    - Hash sempre prefixado com `$argon2id$`
    - _Requirements: 1.4_

  - [x] 4.2 Write property test for password hashing round-trip
    - **Property 1: Hash de senha é round-trip e nunca expõe a senha em claro**
    - **Validates: Requirements 1.4**

  - [x] 4.3 Implement session repository and resolveSession
    - `src/server/auth/sessions.ts` com `createSession`, `revokeSession`, `resolveSession`
    - Atualiza `lastSeenAt` (com throttle ≥ 60s)
    - Cookie HTTP-only assinado por HMAC com `SESSION_SECRET`
    - _Requirements: 1.1, 1.5, 1.6, 1.7_

  - [x] 4.4 Write property test for session lifecycle
    - **Property 4: Ciclo de vida da sessão é consistente**
    - **Validates: Requirements 1.5, 1.6, 1.7**

  - [x] 4.5 Implement login service with email rate limiting
    - `src/server/auth/login.ts` com `login(email, password)`
    - Em transação: ler `LoginAttempt` últimos 15 min para o email; se ≥ 5 falhas, retornar `RATE_LIMITED` sem verificar senha
    - Verificar senha com argon2; em sucesso criar sessão com `expiresAt ≤ now+30d`; em falha registrar `LoginAttempt(success=false)`
    - Mensagens públicas idênticas para email inexistente e senha incorreta
    - _Requirements: 1.1, 1.2, 1.3, 1.8_

  - [x] 4.6 Write property test for indistinguishable invalid credentials
    - **Property 2: Credenciais inválidas produzem resposta indistinguível**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 4.7 Write property test for login session within 30 days
    - **Property 3: Login bem-sucedido cria sessão dentro do limite de 30 dias**
    - **Validates: Requirements 1.1**

  - [x] 4.8 Write property test for login rate limit
    - **Property 5: Rate limit por email aplica corte exato em 5 falhas em 15 minutos**
    - **Validates: Requirements 1.8**

  - [x] 4.9 Implement logout (session revocation)
    - `logout(sessionId)` marca `revokedAt = now()`; cookie é apagado
    - _Requirements: 1.5, 1.7_

  - [x] 4.10 Implement /api/auth/login and /api/auth/logout route handlers
    - Definir cookie de sessão (Secure, HttpOnly, SameSite=Lax) em login
    - Em rate limit, retornar 429 com header `Retry-After`
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.7, 1.8_

  - [x] 4.11 Implement /login page UI consuming Biblioteca_de_Componentes
    - Form com Input/Button da biblioteca, mensagens genéricas de erro, redirect pós-login conforme `userType`
    - _Requirements: 1.1, 1.6_

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Sistema_de_Cadastro_Cliente
  - [x] 6.1 Implement registrar service in server/cadastro-cliente
    - `registrar(input)`: valida com Zod (reusa schemas do passo 2.1), normaliza email/identificador para lower-case
    - Em transação: verificar unicidade case-insensitive de email e identificador, inserir `User(type=CLIENTE)`, criar `ClientProfile`, criar sessão
    - Retornar union `{ ok: true, userId, sessionId } | { ok: false, reason }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 6.2 Write property test for Cliente signup round-trip
    - **Property 7: Cadastro de Cliente válido é round-trip e cria sessão**
    - **Validates: Requirements 2.2, 2.10**

  - [x] 6.3 Write property test for email uniqueness case-insensitive
    - **Property 8: Unicidade de email é case-insensitive**
    - **Validates: Requirements 2.3**

  - [x] 6.4 Write property test for identificador uniqueness case-insensitive
    - **Property 9: Unicidade de identificador é case-insensitive**
    - **Validates: Requirements 2.4**

  - [x] 6.5 Implement /cadastro/cliente page UI and server action
    - Form com nome, email, identificador, senha e Foto_de_Perfil opcional (validada e staged via `POST /api/cadastro/cliente/foto`); mensagens de erro por campo; em sucesso, define cookie e redireciona para a home pública `/` (foco do Cliente é solicitar serviços; a área `/cliente/*` fica reservada para configurações)
    - _Requirements: 2.1, 2.2, 2.9, 2.10_

- [x] 7. Implement Sistema_de_Localidades
  - [x] 7.1 Implement IBGE HTTP client in lib/ibge.ts
    - `fetchEstados()` e `fetchCidades(uf)` com timeout de 5s e tipos `Estado`/`Cidade`
    - Erros traduzidos em `IBGE_TIMEOUT` e `IBGE_ERROR`
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 7.2 Implement IbgeCache repository
    - `getCache(key)`, `upsertCache(key, payload, ttlMs)` na tabela `IbgeCacheEntry`
    - Camada em memória por processo invalidada por `expiresAt`
    - TTL configurado por `IBGE_CACHE_TTL_HOURS` no intervalo [24, 168] horas
    - _Requirements: 4.5_

  - [x] 7.3 Implement LocalidadesService with cache + fallback policy
    - `listarEstados`, `listarCidades(uf)`, `validar(uf, cidade)` em `src/server/localidades`
    - Política exata: cache válido → cache (sem chamar IBGE); cache ausente/expirado + IBGE OK → IBGE + upsert; IBGE falha + cache stale → cache stale com `stale=true`; ausente + IBGE falha → `{ ok: false }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.4 Write property test for 27 UFs
    - **Property 17: Listagem de estados sempre retorna 27 UFs**
    - **Validates: Requirements 4.1**

  - [x] 7.5 Write property test for cidades belong to estado
    - **Property 18: Cidades retornadas pertencem ao estado consultado**
    - **Validates: Requirements 4.2**

  - [x] 7.6 Write property test for validar cartesian product
    - **Property 19: Validação de localidade aceita exatamente o produto cartesiano oficial**
    - **Validates: Requirements 4.3**

  - [x] 7.7 Write property test for deterministic IBGE fallback table
    - **Property 20: Comportamento determinístico do fallback do IBGE**
    - **Validates: Requirements 4.4, 4.5**

  - [x] 7.8 Write property test for IBGE cache TTL bounds
    - **Property 21: TTL do cache IBGE está sempre no intervalo permitido**
    - **Validates: Requirements 4.5**

  - [x] 7.9 Implement /api/localidades route handlers
    - GET `/api/localidades/estados` e `/api/localidades/cidades?uf=`
    - Em fallback stale, header `X-IBGE-Stale: true`; em ausência total, 503 com código `IBGE_UNAVAILABLE`
    - _Requirements: 4.1, 4.2, 4.4_

- [x] 8. Implement Sistema_de_Planos
  - [x] 8.1 Define PLANO_DEFINITIONS constant
    - `src/domain/plano/definitions.ts`: `BASICO` (limiteMidias=10, permiteStories=false, prioridadeBusca=false, permiteAudio=false), `PREMIUM` (limiteMidias=50, permiteStories=true, prioridadeBusca=true, permiteAudio=true)
    - Constante `as const` imutável
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.2 Write property test for plan definitions
    - **Property 22: Definições de plano refletem fielmente os requisitos**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 8.3 Implement PlanoService.selecionar and obterVigente
    - `selecionar(acompanhanteId, tipo)`: rejeita string fora de `{BASICO, PREMIUM}` com `INVALIDO`; em persistência atualiza `AcompanhanteProfile.planoVigente` e `planoSelecionadoEm`; idempotente quando já é o plano vigente
    - `obterVigente(acompanhanteId)` retorna `PlanoDefinition | null`
    - Em erro de banco retorna `PERSISTENCIA` mantendo `null` se ainda não havia plano
    - _Requirements: 5.4, 5.6, 5.8, 5.9_

  - [x] 8.4 Write property test for plan selection round-trip
    - **Property 23: Seleção de plano é round-trip persistente**
    - **Validates: Requirements 5.4, 5.6**

  - [x] 8.5 Write property test for invalid plan rejection
    - **Property 24: Seleção inválida é rejeitada e mantém estado**
    - **Validates: Requirements 5.8**

  - [x] 8.6 Write property test for persistence failure retries
    - **Property 25: Falhas de persistência mantêm o acompanhante sem plano e permitem retentativa**
    - **Validates: Requirements 5.9**

  - [x] 8.7 Write property test for foto perfil not counted in plan limit
    - **Property 27: Foto de Perfil não conta no limite de mídias do plano**
    - **Validates: Requirements 5.7**

  - [x] 8.8 Implement /selecao-plano page and server action
    - Lista `Plano_Basico` e `Plano_Premium` com descrição; ao confirmar, chama `selecionar` e redireciona para área autenticada de Acompanhante; mensagens de erro para `INVALIDO`/`PERSISTENCIA`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.8, 5.9, 5.10_

- [x] 9. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement infrastructure adapters (R2 e Mercado Pago)
  - [x] 10.1 Implement lib/storage/r2.ts (single point of contact with R2)
    - Cliente S3-compatível usando variáveis `R2_*`
    - API estável: `putStaged(key, bytes, mime)`, `commit(stagedKey, finalKey)`, `deleteObject(key)`, `presignedUrl(key)`
    - Erros traduzidos para códigos internos (`R2_UPLOAD_FAILED`, etc.) sem propagar tipos do SDK
    - _Requirements: 7.7_

  - [x] 10.2 Write property test for R2 SDK confinement
    - **Property 32: Confinamento do SDK do Cloudflare R2**
    - **Validates: Requirements 7.7**
    - Parsear imports em `src/**` e falhar se algum arquivo fora de `src/lib/storage/r2.ts` importa SDK do R2/S3

  - [x] 10.3 Implement lib/payments/mercadopago.ts skeleton
    - Cliente confinado a esse módulo, mesmo que não usado no MVP; expõe interface mínima para evolução; lê credenciais e ambiente de variáveis `MP_*`
    - _Requirements: 7.8_

  - [x] 10.4 Write property test for Mercado Pago SDK confinement
    - **Property 33: Confinamento do SDK do Mercado Pago**
    - **Validates: Requirements 7.8**

- [x] 11. Implement Sistema_de_Onboarding
  - [x] 11.1 Implement onboarding draft service (iniciar, atualizarEtapa, descartar)
    - `src/server/onboarding/drafts.ts`: cria/atualiza `OnboardingDraft` com `expiresAt = updatedAt + 60min`; cookie httpOnly com `onboardingId`; mesclagem de patches por chave (último vence) sem perder dados ao voltar
    - `descartar(onboardingId)` apaga draft e objeto staged em R2 se existir
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 11.2 Write property test for partial state preservation
    - **Property 13: Estado parcial do onboarding é preservado entre etapas**
    - **Validates: Requirements 3.2**

  - [x] 11.3 Write property test for draft expiration
    - **Property 14: Drafts de onboarding expiram após 60 minutos de inatividade**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 11.4 Implement uploadFoto via R2 staged path
    - `uploadFoto(onboardingId, file)`: valida mime e tamanho (reusa `validarFotoPerfil`), grava em `staged/<uuid>` via `lib/storage/r2`, atualiza `stagedKey` no draft
    - _Requirements: 3.10_

  - [x] 11.5 Implement finalizar with atomic transaction + R2 commit/cleanup
    - Recarregar draft, revalidar todos os campos com schemas do passo 2.1, revalidar `(estadoSigla, cidadeNome)` via `LocalidadesService.validar`
    - `prisma.$transaction`: INSERT `User(type=ACOMPANHANTE)` (com argon2 hash), INSERT `AcompanhanteProfile`, INSERT `Media(isProfilePhoto=true, status=COMMITTED, storageKey = committed/<userId>/profile.<ext>)`, DELETE draft
    - Pós-commit: `r2.commit(stagedKey, finalKey)` + DELETE staged; em falha pós-commit marca `Media.status = PENDING_REPAIR` e enfileira retry idempotente
    - Em falha de transação: ROLLBACK + DELETE staged em `finally`
    - Em sucesso, criar sessão e retornar `sessionId` para o handler colocar no cookie
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.11, 3.12, 4.3_

  - [x] 11.6 Write property test for onboarding atomicity
    - **Property 15: Atomicidade do onboarding (tudo ou nada)**
    - **Validates: Requirements 3.5, 3.6**

  - [x] 11.7 Write property test for onboarding validation reuse
    - **Property 16: Onboarding reusa as regras de validação do cadastro**
    - **Validates: Requirements 3.1, 3.7, 3.12**

  - [x] 11.8 Implement multi-step onboarding UI pages
    - Páginas em `src/app/(public)/cadastro/acompanhante/[step]` consumindo Biblioteca_de_Componentes
    - Steps cobrindo: identidade (nome/email/identificador/senha) → telefone → localidade (Estado + Cidade via `/api/localidades` com até 3 retentativas) → descrição → foto → confirmação que chama `finalizar`
    - Bloquear avanço com campos inválidos exibindo mensagens; permitir voltar sem perder dados
    - Após sucesso, redirecionar para `/selecao-plano`
    - _Requirements: 3.1, 3.2, 3.11, 3.12, 4.4_

  - [x] 11.9 Implement cleanup of expired drafts and orphan staged objects
    - Limpeza preguiçosa em cada acesso ao onboarding e função utilitária `cleanupExpiredDrafts()` invocável por cron simples; remove drafts com `expiresAt < now()` e objetos `staged/` correspondentes ou mais antigos que 1 hora sem draft associado
    - _Requirements: 3.3, 3.4, 3.6_

- [x] 12. Implement middleware and route protection
  - [x] 12.1 Implement src/middleware.ts
    - Lê cookie de sessão, valida via `resolveSession`, injeta `x-user-id`/`x-user-type` em headers internos
    - Rotas `(acompanhante)/*` exigem `userType=ACOMPANHANTE` e `planoVigente !== null`, exceto `/selecao-plano`
    - Se `ACOMPANHANTE` sem plano acessar área protegida, redireciona para `/selecao-plano`; se com plano acessar `/selecao-plano`, redireciona para área principal
    - Rotas `(cliente)/*` exigem `userType=CLIENTE`
    - _Requirements: 1.6, 1.7, 5.5, 5.10_

  - [x] 12.2 Write property test for acompanhante route protection by plan
    - **Property 26: Acesso a áreas de Acompanhante depende do plano vigente**
    - **Validates: Requirements 5.5, 5.10**

- [x] 13. Implement integration tests for end-to-end flows
  - [x] 13.1 Integration test: cadastro Cliente end-to-end
    - Submeter form → conta criada com tipo CLIENTE → cookie de sessão válido → `resolveSession` ok
    - _Requirements: 2.2, 2.10_

  - [x] 13.2 Integration test: onboarding completo + seleção de plano
    - Percorrer todos os steps com mocks de IBGE (msw) e R2 (stub) → finalizar → `/selecao-plano` → escolher plano → área de Acompanhante acessível
    - _Requirements: 3.5, 3.11, 5.1, 5.4, 5.10_

  - [x] 13.3 Integration test: falha simulada no banco durante onboarding
    - Forçar erro na transação → assert que conta não foi criada, draft permanece, objeto staged removido, retentativa funciona
    - _Requirements: 3.6, 5.9_

  - [x] 13.4 Integration test: localidades com IBGE indisponível
    - Mock IBGE com timeout/erro e cache vazio → primeira chamada falha (503), até 3 retentativas, dados de onboarding preservados
    - _Requirements: 4.1, 4.4_

  - [x] 13.5 Integration test: redirecionamento pós-login conforme userType
    - Login Cliente → home pública `/`; Login Acompanhante sem plano → `/acompanhante/selecao-plano`; Login Acompanhante com plano → área de Acompanhante
    - _Requirements: 1.6, 5.5, 5.10_

- [x] 14. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP. Eles cobrem testes (property-based, unit e integration) e podem ser executados depois.
- Cada task referencia explicitamente requisitos para rastreabilidade reversa.
- As 33 Correctness Properties do design estão todas mapeadas em sub-tasks de teste, posicionadas o mais perto possível do código que validam.
- Checkpoints existem para validação incremental e oportunidade de esclarecimento.
- A linguagem de implementação é TypeScript (Next.js 15 + App Router), conforme stack alvo do design.
- Sub-tasks dentro de uma mesma feature seguem ordem incremental: implementação → testes da implementação → integração com UI/handlers.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["1.7", "1.8", "2.1", "3.1", "4.1", "7.1", "8.1", "10.1", "10.3"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2", "4.2", "4.3", "7.2", "8.2", "10.2", "10.4", "11.1"] },
    { "id": 4, "tasks": ["3.3", "4.4", "4.5", "4.9", "6.1", "7.3", "8.3", "11.2", "11.3", "11.4"] },
    { "id": 5, "tasks": ["3.4", "3.5", "4.6", "4.7", "4.8", "4.10", "6.2", "6.3", "6.4", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "8.4", "8.5", "8.6", "8.7", "11.5", "11.9"] },
    { "id": 6, "tasks": ["4.11", "6.5", "8.8", "11.6", "11.7", "11.8", "12.1"] },
    { "id": 7, "tasks": ["12.2", "13.1", "13.2", "13.3", "13.4", "13.5"] }
  ]
}
```
