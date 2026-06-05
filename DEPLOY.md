# Guia de Deploy — Privello (Railway)

Este documento detalha o deploy da Privello no Railway com o domínio `privello.com.br` / `www.privello.com.br`.

## Ordem correta dos passos

A ordem importa: o webhook do Stripe precisa do domínio já no ar. Siga nesta sequência:

1. Provisionar Postgres no Railway
2. Subir o serviço (deploy do repo) com as variáveis de ambiente
3. Apontar o domínio (Railway + Registro.br) e esperar o DNS/SSL
4. Confirmar que `https://www.privello.com.br` abre
5. **Só então** registrar o webhook do Stripe e colar o `STRIPE_WEBHOOK_SECRET`
6. Redeploy (pra subir com o webhook secret) e testar um pagamento

---

## 1. Pré-requisitos (já prontos no repo)

- `railway.toml` → builder Docker apontando pra `docker/Dockerfile`
- `Dockerfile` multi-stage → roda `check-env.js` + `prisma migrate deploy` + `next start` (standalone)
- `next.config.ts` → `output: "standalone"` e CSP já liberando `js.stripe.com` / `api.stripe.com` / `hooks.stripe.com`

Você não precisa mexer em nada disso. O Railway builda pelo Dockerfile e as migrations rodam sozinhas no boot.

---

## 2. Banco de dados (Railway Postgres)

1. No projeto do Railway, **+ New → Database → PostgreSQL**
2. O Railway cria a variável `DATABASE_URL` automaticamente
3. Referencie ela no serviço da app (ou copie o valor) — o `prisma migrate deploy` do boot aplica todas as migrations no primeiro deploy

---

## 3. Subir o serviço

1. **+ New → GitHub Repo** (ou `railway up` pela CLI) apontando pra este repositório
2. Railway detecta o `railway.toml` e builda pelo Dockerfile
3. Configure as variáveis de ambiente (seção 4) **antes** do primeiro deploy concluir — senão o `check-env.js` aborta o boot (é proposital)

---

## 4. Variáveis de Ambiente (Railway)

```bash
# Banco — referencie o plugin Postgres do Railway
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Sessões — gere com: openssl rand -base64 32
SESSION_SECRET=<32+ chars aleatórios>

# URL pública (metadata, sitemap, OG, marca d'água, success_url do checkout)
NEXT_PUBLIC_SITE_URL=https://www.privello.com.br

# Cloudflare R2 (storage de mídia) — OBRIGATÓRIO, sem isso o boot aborta
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
R2_BUCKET=<bucket>
R2_PUBLIC_BASE_URL=https://<bucket-publico>.r2.dev

# Stripe (chaves LIVE)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=        # deixe vazio AGORA; preenche no passo 6

# IBGE
IBGE_BASE_URL=https://servicodados.ibge.gov.br/api
IBGE_CACHE_TTL_HOURS=72

# Opcional — token pro POST /api/cleanup (cron de limpeza)
CLEANUP_TOKEN=<token forte se for usar cron>
```

Notas:
- `PORT` o Railway injeta sozinho — não precisa setar.
- Sem `STRIPE_WEBHOOK_SECRET` o app sobe normal, mas pagamentos não ativam (o webhook responde 503). Você preenche no passo 6.
- `R2_*` é obrigatório (o `check-env.js` aborta se faltar). Crie um bucket no Cloudflare R2 e um token de API antes.

---

## 5. Domínio (Railway + Registro.br)

### 5.1. No Railway
1. Serviço → **Settings → Networking → Custom Domain**
2. Adicione `www.privello.com.br`
3. Railway mostra um alvo **CNAME** (ex.: `abc123.up.railway.app`) — copie

### 5.2. No Registro.br
1. Painel do domínio → **DNS / Editar Zona**
2. Adicione:
   ```
   Nome: www
   Tipo: CNAME
   Valor: <alvo-do-railway>.up.railway.app
   ```
3. Para o domínio raiz `privello.com.br` → `www` (o Registro.br não faz CNAME na raiz):
   - Use o recurso de **redirecionamento de URL** do Registro.br: `privello.com.br` → `https://www.privello.com.br` (301)
   - OU coloque o domínio atrás do Cloudflare (grátis) e use CNAME flattening / Page Rule de redirect

Propagação: normalmente < 1h, podendo levar até 48h. O Railway emite o certificado SSL automático assim que o DNS resolve.

### 5.3. Confirme
Abra `https://www.privello.com.br` — o site tem que carregar com cadeado (HTTPS). Só siga pro webhook depois disso.

---

## 6. Webhook do Stripe (só depois do domínio no ar)

1. Acesse https://dashboard.stripe.com/webhooks (modo **Live**, não Test)
2. **Add endpoint**
3. **Endpoint URL**: `https://www.privello.com.br/api/payments/stripe/webhook`
4. **Events to send** — selecione os 4 (os de PIX são essenciais):
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`  ← confirmação do PIX
   - `checkout.session.async_payment_failed`     ← PIX expirado/falhou
   - `checkout.session.expired`
5. **Add endpoint** → copie o **Signing secret** (`whsec_...`)
6. No Railway, preencha `STRIPE_WEBHOOK_SECRET=whsec_...`
7. **Redeploy** o serviço pra subir com o secret

### 6.1. Habilitar PIX
No Stripe: **Settings → Payment methods → PIX → Turn on**. Requer conta Stripe brasileira com PIX aprovado. Sem isso, só cartão aparece no checkout (o código já pede `["card", "pix"]`, o Stripe mostra o que estiver habilitado).

---

## 7. Configuração do DNS (Registro.br) — referência rápida

No painel do Registro.br:

1. Acesse **DNS** → **Editar Zona**
2. Adicione um registro **CNAME**:
   ```
   Nome: www
   Tipo: CNAME
   Valor: <cname-fornecido-pelo-railway>
   TTL: 3600 (ou deixe o padrão)
   ```
3. Salve as alterações

**Tempo de propagação**: pode levar de 15 minutos a 48 horas (geralmente < 1 hora).

### 3.1. Redirect do domínio raiz (opcional)

Se você quiser que `privello.com.br` (sem www) redirecione para `www.privello.com.br`:

1. No Registro.br, adicione um registro **URL Redirect**:
   ```
   De: privello.com.br
   Para: https://www.privello.com.br
   Tipo: 301 (permanente)
   ```

**Alternativa**: Se o Registro.br não oferece redirect, use o Cloudflare (grátis):
- Aponte os nameservers pro Cloudflare
- Configure um **Page Rule** de redirect

---

## 4. Migração do Banco de Dados

**⚠️ Execute isso ANTES do primeiro deploy em produção.**

A migration renomeia as colunas do Mercado Pago → Stripe:

```bash
# Localmente (se quiser validar):
npx prisma migrate dev

# No Railway (via terminal ou build command):
npx prisma migrate deploy
```

**O que a migration faz:**
- Renomeia `mp_preference_id` → `stripe_session_id`
- Renomeia `mp_payment_id` → `stripe_payment_intent_id`

---

## 5. Build & Deploy

### 5.1. Build Command (Railway)

Configure no **Settings** → **Build**:

```bash
npm run build
```

### 5.2. Start Command (Railway)

```bash
npm run start
```

### 5.3. Rodando Migrations Automaticamente

Adicione no `package.json` um script de build customizado:

```json
"scripts": {
  "build": "prisma generate && prisma migrate deploy && next build",
  "start": "next start"
}
```

Assim, toda vez que o Railway fizer deploy, as migrations rodam automaticamente.

---

## 6. Checklist Pós-Deploy

Após o deploy e a propagação do DNS:

- [ ] Acesse `https://www.privello.com.br` e confirme que o site carrega
- [ ] Teste o login/cadastro
- [ ] Teste o upload de foto (R2)
- [ ] Faça uma compra de teste do Boost (Stripe modo test, se disponível)
- [ ] Confirme que o webhook do Stripe está recebendo eventos (veja o log no dashboard)
- [ ] Verifique que a marca d'água nas fotos mostra `www.privello.com.br/@usuario`
- [ ] Teste o redirect `privello.com.br/usuario` → `/acompanhantes/usuario` (se implementado)

---

## 7. Monitoramento & Logs

- **Logs do Railway**: `railway logs`
- **Erros do Stripe**: https://dashboard.stripe.com/logs
- **Uptime**: Configure um monitor (ex: UptimeRobot, BetterStack)

---

## 8. Troubleshooting

### 8.1. "Webhook signature verification failed"

- Confirme que `STRIPE_WEBHOOK_SECRET` no Railway está correto
- Confirme que o endpoint URL no Stripe é exatamente `https://www.privello.com.br/api/payments/stripe/webhook`

### 8.2. Domínio não resolve

- Verifique se o CNAME está correto: `dig www.privello.com.br`
- Aguarde a propagação (até 48h, mas geralmente < 1h)

### 8.3. Erro de migração

- Execute `npx prisma migrate status` pra ver o estado
- Se houver migrations pendentes, rode `npx prisma migrate deploy`

---

## 9. Rollback

Se algo der errado:

1. **Railway**: Reverta pro deploy anterior via dashboard
2. **Banco**: Crie um backup antes de rodar migrations:
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

---

**Pronto! 🚀**

Qualquer dúvida, consulte a documentação do Railway ou do Stripe.
