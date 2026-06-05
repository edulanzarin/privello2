# Guia de Deploy — Privello em Produção

Este documento contém as instruções para colocar o Privello no ar com o domínio **www.privello.com.br** usando Railway.

---

## Pré-requisitos

- Domínio `www.privello.com.br` já registrado no Registro.br ✅
- Conta no [Railway](https://railway.app)
- Conta no [Stripe](https://stripe.com) (chaves live já configuradas no `.env`)
- Conta no Cloudflare R2 para storage de imagens

---

## 1. Configurar o Webhook do Stripe

**Você precisa fazer isso no dashboard do Stripe:**

1. Acesse https://dashboard.stripe.com/webhooks
2. Clique em **"Add endpoint"**
3. **Endpoint URL:** `https://www.privello.com.br/api/payments/stripe/webhook`
4. **Events to send:** Selecione:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Clique **"Add endpoint"**
6. Copie o **Signing secret** (começa com `whsec_...`)
7. Guarde esse valor — você vai precisar dele no Railway

---

## 2. Migrar o Banco de Dados

Antes de subir para produção, você precisa rodar a migration que renomeia as colunas do Mercado Pago para Stripe:

```bash
# No ambiente de produção, após conectar ao banco:
npx prisma migrate deploy
```

Isso vai aplicar a migration `20260127_stripe_columns` que renomeia:
- `mp_preference_id` → `stripe_session_id`
- `mp_payment_id` → `stripe_payment_intent_id`

---

## 3. Deploy no Railway

### 3.1. Criar o Projeto

1. Acesse https://railway.app e faça login
2. Clique em **"New Project"**
3. Escolha **"Deploy from GitHub repo"**
4. Conecte seu repositório do Privello

### 3.2. Adicionar o Banco PostgreSQL

1. No projeto, clique em **"+ New"**
2. Escolha **"Database → PostgreSQL"**
3. Railway vai provisionar um banco automaticamente
4. A `DATABASE_URL` será injetada automaticamente no ambiente

### 3.3. Configurar as Variáveis de Ambiente

No painel do Railway, vá em **Variables** e adicione:

```bash
# Base
NODE_ENV=production
PORT=3000
SESSION_SECRET=<GERE_UM_SECRET_FORTE_AQUI>

# Site
NEXT_PUBLIC_SITE_URL=https://www.privello.com.br

# Stripe (chaves live)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=<COLE_O_WEBHOOK_SECRET_DO_STRIPE_AQUI>

# Cloudflare R2 (storage de imagens)
R2_ACCOUNT_ID=<SUA_CONTA_R2>
R2_ACCESS_KEY_ID=<SUA_ACCESS_KEY>
R2_SECRET_ACCESS_KEY=<SUA_SECRET_KEY>
R2_BUCKET=<NOME_DO_BUCKET>
R2_PUBLIC_BASE_URL=<URL_PUBLICA_DO_R2>

# IBGE (já configurado)
IBGE_BASE_URL=https://servicodados.ibge.gov.br/api
IBGE_CACHE_TTL_HOURS=72
```

**⚠️ IMPORTANTE:**
- **SESSION_SECRET:** Gere um valor aleatório forte (ex: `openssl rand -base64 32`)
- **STRIPE_WEBHOOK_SECRET:** Use o valor que você copiou do dashboard do Stripe (passo 1)

### 3.4. Deploy Automático

Railway detecta o `package.json` e roda automaticamente:

```bash
npm run build
npm run start
```

O deploy é automático a cada push no branch `main`.

---

## 4. Configurar o DNS (Registro.br → Railway)

### 4.1. Pegar o Domínio do Railway

1. No projeto Railway, clique no serviço (app Next.js)
2. Vá em **Settings → Networking**
3. Clique em **"Generate Domain"** — Railway vai gerar algo como `privello-production.up.railway.app`
4. Copie esse domínio

### 4.2. Adicionar Custom Domain

1. Ainda em **Networking**, clique em **"Custom Domain"**
2. Digite: `www.privello.com.br`
3. Railway vai mostrar um registro CNAME que você precisa criar

### 4.3. Configurar no Registro.br

1. Acesse https://registro.br e faça login
2. Clique em **"Gerenciar Domínio"** → `privello.com.br`
3. Vá em **"DNS"** (ou "Zona de DNS")
4. Adicione o registro:

   **Tipo:** `CNAME`  
   **Nome:** `www`  
   **Valor:** `privello-production.up.railway.app` (ou o domínio que o Railway gerou)  
   **TTL:** 3600

5. Salve

### 4.4. Aguardar Propagação

A propagação do DNS pode levar de **15 minutos a 24 horas**. Para testar:

```bash
# Verifica se o CNAME está propagado
dig www.privello.com.br CNAME

# Ou usando nslookup
nslookup www.privello.com.br
```

Quando estiver propagado, você verá o CNAME apontando para o Railway.

---

## 5. Validar a Instalação

Depois que o DNS propagar e o Railway fazer o deploy:

### 5.1. Acessar o Site

1. Abra https://www.privello.com.br
2. Verifique se a home carrega
3. Teste o cadastro/login

### 5.2. Testar o Boost (Stripe)

1. Faça login como acompanhante
2. Vá em "Meu Perfil" → "Boost"
3. Clique em "Ativar Boost" e escolha um plano
4. Use um cartão de teste do Stripe:
   - Número: `4242 4242 4242 4242`
   - Data: qualquer data futura
   - CVC: qualquer 3 dígitos
5. Complete o pagamento
6. Verifique se o webhook foi recebido:
   - Dashboard Stripe → Webhooks → Clique no endpoint → Aba "Events"
   - Deve aparecer `checkout.session.completed`
7. Volte ao perfil e confirme que o boost foi ativado

### 5.3. Verificar a Marca d'Água

1. Abra uma foto de perfil de acompanhante
2. A marca d'água deve mostrar:
   - Logo do Privello (ícone)
   - Texto "Privello"
   - Link: `www.privello.com.br/@username`

---

## 6. Monitoramento

### Logs no Railway

Para ver os logs em tempo real:

1. No projeto Railway, clique no serviço
2. Vá em **"Deployments"**
3. Clique no deployment ativo
4. Clique em **"View Logs"**

### Webhooks do Stripe

Para debugar problemas com pagamentos:

1. Acesse https://dashboard.stripe.com/webhooks
2. Clique no endpoint configurado
3. Vá em **"Events"** para ver todos os eventos recebidos
4. Se algum webhook falhar (status 4xx/5xx), clique em **"Resend"**

---

## 7. Segurança

### Ambiente

✅ **Não commitar** o `.env` no Git (já está no `.gitignore`)  
✅ **Usar secrets** do Railway para variáveis sensíveis  
✅ **Webhook secret** do Stripe está ativo — garante que só o Stripe pode chamar o endpoint

### HTTPS

Railway provê HTTPS automático. **Nunca** desabilite.

### Session Secret

Use um valor forte e único em produção. **Nunca** reutilize o valor de desenvolvimento.

---

## 8. Backup e Recuperação

### Banco de Dados

Railway faz backups automáticos do PostgreSQL. Para restaurar:

1. Painel do Railway → Database → Backups
2. Escolha o backup → Restore

### Storage (R2)

Configure versionamento no bucket R2:

1. Cloudflare Dashboard → R2 → Seu Bucket
2. Settings → Lifecycle Rules → Enable versioning

---

## Troubleshooting

### DNS não propaga

- Aguarde até 24h
- Use `dig` ou `nslookup` para verificar
- Certifique-se de que o CNAME está correto no Registro.br

### Webhook do Stripe não funciona

- Verifique se `STRIPE_WEBHOOK_SECRET` está configurado no Railway
- Teste manualmente: Dashboard Stripe → Webhooks → Endpoint → "Send test webhook"
- Veja os logs do Railway para erros

### Build falha no Railway

- Verifique os logs em "Deployments"
- Certifique-se de que todas as variáveis de ambiente estão configuradas
- Teste localmente: `npm run build`

### Marca d'água mostra "localhost"

- Verifique se `NEXT_PUBLIC_SITE_URL=https://www.privello.com.br` está configurado no Railway
- Rebuild o projeto (Railway → Deployments → Trigger Deploy)

---

## Checklist Final

Antes de marcar como concluído:

- [ ] Webhook do Stripe configurado e testado
- [ ] Migration do banco aplicada (`prisma migrate deploy`)
- [ ] Deploy no Railway concluído (build verde)
- [ ] DNS propagado (`www.privello.com.br` resolve)
- [ ] HTTPS funcionando
- [ ] Variáveis de ambiente configuradas (incluindo `STRIPE_WEBHOOK_SECRET`)
- [ ] Teste de pagamento (boost) funcionando
- [ ] Marca d'água mostrando domínio correto
- [ ] Logs sem erros críticos

---

🚀 **Privello está no ar!**

Qualquer dúvida, consulte os logs do Railway ou do Stripe para debugar.
