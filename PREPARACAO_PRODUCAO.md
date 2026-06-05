# ✅ Preparação para Produção — Privello

## Resumo das Alterações

O projeto foi preparado para o deploy em produção com o domínio `www.privello.com.br` e **integração completa de pagamentos com o Stripe**.

**🎉 IMPORTANTE: Todos os pagamentos (Boost e Planos Fan) agora passam por checkout real do Stripe. Nada é ativado automaticamente sem pagamento confirmado!**

---

## 🔧 Alterações Realizadas

### 1. Migration do Banco de Dados

**Arquivo**: `prisma/migrations/20260127_stripe_columns/migration.sql`

Renomeia as colunas da tabela `BoostPayment`:
- `mp_preference_id` → `stripe_session_id`
- `mp_payment_id` → `stripe_payment_intent_id`

**Como aplicar**:
```bash
npx prisma migrate deploy
```

### 2. Schema Prisma Atualizado

**Arquivo**: `prisma/schema.prisma`

- Colunas renomeadas no model `BoostPayment`
- Comentários atualizados (removidas referências ao Mercado Pago)
- Documentação alinhada com o Stripe

### 3. Variáveis de Ambiente

**Arquivo**: `.env.example`

Novas variáveis obrigatórias:

```bash
# URL pública do site (marca d'água, webhooks, redirects)
NEXT_PUBLIC_SITE_URL=https://www.privello.com.br

# Stripe (substituindo Mercado Pago)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...  # (você pega do dashboard)
```

**Removidas**:
- `MP_ACCESS_TOKEN`
- `MP_ENVIRONMENT`

### 4. Código TypeScript Atualizado

**Sistema de Pagamentos Completo**:
- ✅ **Boost da Acompanhante** — usa Stripe (já estava implementado)
- ✅ **Plano Fan do Cliente** — **AGORA usa Stripe** (implementado agora)
- ✅ **Webhook único** — `/api/payments/stripe/webhook` roteia ambos
- ✅ **Tabela FanPayment** — rastreamento de pagamentos de planos
- ✅ **Checkout do Fan** — endpoint `/api/cliente/fan/checkout`
- ✅ **Nenhuma ativação automática** — tudo passa por webhook confirmado

**Arquivos modificados/criados**:
- `src/server/boost/index.ts` — comentários e lógica do Stripe
- `src/domain/boost/definitions.ts` — documentação atualizada
- `src/app/acompanhante/boost/page.tsx` — comentários
- `src/app/acompanhante/boost/BoostCheckoutButton.tsx` — comentários
- `src/app/cliente/selecao-plano/actions.ts` — comentários
- `src/domain/plano-cliente/definitions.ts` — documentação
- `src/server/auth/csrf.ts` — comentários
- `src/lib/env.ts` — validação das envs do Stripe

Todas as referências ao Mercado Pago foram substituídas por Stripe.

### 5. Documentação de Deploy

**Arquivo**: `DEPLOY.md`

Guia completo com:
- Configuração do webhook no Stripe
- Variáveis de ambiente do Railway
- Configuração do DNS no Registro.br
- Migração do banco
- Checklist pós-deploy
- Troubleshooting

---

## 📋 Próximos Passos (você precisa fazer)

### 1. Registrar o Webhook no Stripe

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em **"Add endpoint"**
3. Configure:
   - **Endpoint URL**: `https://www.privello.com.br/api/payments/stripe/webhook`
   - **Events**: `checkout.session.completed`, `checkout.session.expired`
4. Copie o **Signing secret** (`whsec_...`)
5. Adicione no Railway: `STRIPE_WEBHOOK_SECRET=whsec_...`

### 2. Configurar o Railway

No painel do Railway, adicione as variáveis de ambiente (veja `DEPLOY.md` pra lista completa):

```bash
NEXT_PUBLIC_SITE_URL=https://www.privello.com.br
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
# ... outras variáveis (R2, DATABASE_URL, etc)
```

### 3. Configurar o DNS

No Registro.br:

1. Adicione um **CNAME**:
   ```
   Nome: www
   Tipo: CNAME
   Valor: <cname-do-railway>.up.railway.app
   ```

2. (Opcional) Redirect do domínio raiz:
   ```
   privello.com.br → https://www.privello.com.br
   ```

### 4. Deploy

Faça o push pro Railway:

```bash
git add .
git commit -m "feat: preparar produção com Stripe e domínio www.privello.com.br"
git push railway main
```

As migrations rodarão automaticamente (se configurou o build script corretamente).

---

## ✅ Checklist Pós-Deploy

- [ ] Site carrega em `https://www.privello.com.br`
- [ ] Marca d'água mostra `www.privello.com.br/@usuario`
- [ ] Webhook do Stripe está recebendo eventos
- [ ] Login/cadastro funcionando
- [ ] Upload de mídia (R2) funcionando
- [ ] Compra de Boost (teste com cartão de teste do Stripe)
- [ ] **Compra de plano Fan (teste com cartão de teste do Stripe)**
- [ ] **Verificar que nada é ativado sem pagamento confirmado**
- [ ] Redirect `privello.com.br/usuario` → `/acompanhantes/usuario` (se implementado)

---

## 🚨 Notas Importantes

1. **Marca d'água**: Já usa `NEXT_PUBLIC_SITE_URL`, então vai pegar o novo domínio automaticamente.

2. **Redirect de perfil**: O sistema de redirect `privello.com.br/usuario` → `/acompanhantes/usuario` precisa ser implementado se você quiser essa funcionalidade (hoje não existe).

3. **Testes locais**: Pra testar localmente com o Stripe, use as chaves de teste (`sk_test_...` e `pk_test_...`) e configure o webhook pra `http://localhost:3000/api/payments/stripe/webhook` (ou use o Stripe CLI: `stripe listen --forward-to localhost:3000/api/payments/stripe/webhook`).

---

**✅ PAGAMENTOS ESTÃO 100% INTEGRADOS:**

Veja o arquivo `INTEGRACAO_STRIPE_COMPLETA.md` para detalhes técnicos completos sobre o sistema de pagamentos, fluxos, testes e monitoramento.

**Qualquer dúvida, consulte o `DEPLOY.md` ou a documentação do Stripe/Railway.**
