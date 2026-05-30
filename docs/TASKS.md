# Tasks — Privello

Lista de tasks priorizadas. Atualizar status conforme avançamos:
- ⬜ Pendente
- 🟡 Em progresso
- ✅ Concluída
- ❌ Descartada

> **Princípio**: site é vitrine + perguntas públicas. **Sem DM
> 1:1, sem reservas/agenda, sem sinal de Pix**. Contato real é
> sempre via WhatsApp. Privello não intermedia transação nem é
> responsável pelo encontro em si.

---

## Curto prazo (alto ROI, baixo esforço)

### ✅ T01 — Favoritos / Salvos
**Esforço**: ~3h.
**Cliente** marca Acompanhantes como favorita. Lista própria
em `/cliente#favoritos` com cards mini. Contador no header da
Acompanhante ("X clientes te salvaram") apenas pra ela ver no
painel privado.

- [x] Migration: tabela `client_favorites(client_user_id,
      acompanhante_user_id, criado_em)` com unique composto +
      cascade.
- [x] Service `src/server/favorites/index.ts`:
      `marcarFavorito`, `desmarcarFavorito`, `listarFavoritos`,
      `contarFavoritosDoOwner` (toggle unificado +
      `isFavorito` pra estado inicial do botão).
- [x] Endpoint `POST /api/acompanhantes/[slug]/favorite` (toggle).
- [x] Botão "Salvar" (ícone bookmark) no `ProfileHeader` —
      só aparece pra Cliente logado, ao lado do CTA WhatsApp.
- [x] Aba nova "Favoritos" no painel `/cliente`.
- [x] MetricPill "Salva por X" no painel da Acompanhante (só
      ela vê, não vira público).
- [x] Primitivo `BookmarkButton` com estado toggle animado.
- [x] Ícone novo `BookmarkIcon` em icons.tsx.

### ✅ T02 — Filtro "Verificadas apenas" na busca
**Esforço**: ~30min.
**Cliente** pode filtrar pra ver só perfis com selo verificado.
Premia quem fez a verificação e justifica o esforço.

- [x] Adicionar opção `verificada` em `BuscaFiltros` em
      `buscar.ts`.
- [x] Index parcial em `acompanhante_profiles(verificada)
      WHERE verificada = true`.
- [x] Switch "Apenas verificadas" no `FilterPanel`.
- [x] Persistir no querystring `?verificada=1`.

### ✅ T03 — Galeria reordenável
**Esforço**: ~2h.
**Acompanhante** arrasta mídias pra reordenar no painel.
Hoje a ordem é fixa por `createdAt desc`.

- [x] Migration: adicionar `medias.sort_order INT DEFAULT 0`.
- [x] Service: `reordenarGaleria(userId, ids: string[])` em
      `galleryMedia.ts` — atualiza `sort_order` de cada mídia
      em transação.
- [x] Endpoint `PATCH /api/acompanhante/midias/order`.
- [x] Drag-and-drop nativo HTML5 (sem libs externas) no
      `MidiasTab`. Atualiza otimisticamente.
- [x] `listarGaleria` ordena por `sort_order asc, createdAt desc`.

### ✅ T04 — Gamification: completude do perfil
**Esforço**: ~2h.
Bar de progresso "Perfil X% completo" no painel da
Acompanhante. Cada item desbloqueado dá +bônus de visibilidade
(implícito — engajamento). Pode ganhar selo de "Perfil
completo" quando 100%.

- [x] Service `obterCompletude(userId)`: calcula % com base em
      checklist (foto, capa, descrição ≥ 100 chars, áudio,
      verificada, ≥ 5 mídias galeria, ≥ 3 stories histórico,
      todos campos aparência).
- [x] Primitivo `ProgressRing` (SVG circular animado).
- [x] Card "Complete seu perfil" no topo do painel quando < 100%.
- [x] Lista de itens faltantes com link direto pra cada (clicar
      em "adicione áudio" abre AudioTab).
- [x] Badge "Perfil 100%" próximo ao nome quando completo
      (separado do VerifiedBadge).

### ✅ T05 — PWA install prompt
**Esforço**: ~3h.
Site vira instalável no celular (ícone na tela inicial,
abre fullscreen).

- [x] `public/sw.js` — service worker com cache de assets
      estáticos (ícones, CSS) + estratégia network-first pra
      HTML.
- [x] Primitivo `InstallPromptBanner` que detecta evento
      `beforeinstallprompt` e mostra banner.
- [x] Modal de instruções pra iOS (Safari não tem o evento;
      manual via "Compartilhar → Adicionar à tela inicial").
- [x] Persistir "dispensado" em localStorage pra não enchecher.
- [x] Adicionar ícones 192/512 + apple-touch-icon no
      `manifest.webmanifest`.

### ⬜ T06 — Stories Highlights (Destaques)
**Esforço**: ~4h.
Acompanhante salva story expirado (ARCHIVED) em "destaque"
permanente. Aparece no perfil público em rail circular acima
da galeria, estilo Instagram Highlights.

- [ ] Migration: adicionar `medias.highlight_title TEXT NULL,
      medias.highlight_order INT NULL` em colunas existentes
      da tabela.
- [ ] Service: `adicionarAoDestaque(mediaId, title)`,
      `removerDoDestaque`, `listarDestaques(userId)`.
- [ ] Endpoint `POST /api/acompanhante/stories/[id]/highlight`.
- [ ] Botão "Salvar como destaque" no MediaCarousel quando
      é Story arquivado próprio.
- [ ] Rail no perfil público (reusa `StoriesRail` com items
      construídos a partir dos destaques).
- [ ] Modal de "criar destaque" com input de título (≤ 20 chars).

---

## Médio prazo

### ⬜ T07 — Áudios curtos por tópico
**Esforço**: ~4h.
Além do áudio único de apresentação, Acompanhante grava
áudios curtos (≤30s) respondendo perguntas comuns: "Preço",
"Atende casal?", "Disponibilidade". Aparecem como FAQ
sonora no perfil público.

- [ ] Migration: tabela `topic_audios(id, owner_id, tipo enum,
      storage_key, duration_seconds, created_at)` ou reusar
      `Media.role = 'TOPIC_AUDIO'` + nova coluna `topic_kind`.
- [ ] Service: `publicarTopicAudio`, `excluirTopicAudio`,
      `listarTopicAudios`.
- [ ] Endpoints CRUD.
- [ ] UI no painel: aba dedicada com lista de tópicos
      pré-definidos. Cada tópico tem botão "Gravar".
- [ ] No perfil público: seção "Perguntas frequentes em áudio"
      com `AudioWavePlayer` por item.

### ⬜ T08 — Vídeo de apresentação
**Esforço**: ~4h.
Vídeo curto (≤60s) substituindo ou complementando o áudio.
Premium-only.

- [ ] Adicionar `MediaRole.VIDEO_PRESENTATION` ao enum +
      coluna `acompanhante_profiles.video_apresentacao_id`.
- [ ] Service `replaceVideoApresentacao` reusando padrão do
      `replaceUserMediaSlot` (com watermark + poster).
- [ ] Endpoint `PUT /api/acompanhante/video-apresentacao`.
- [ ] Aba "Vídeo" no painel (apenas Premium, condicional).
- [ ] No perfil público: card destaque com player.

### ⬜ T09 — Boost programado
**Esforço**: ~4h.
Acompanhante agenda Boost pra começar em data/hora futura
(ex: "começar sexta 18h"). Útil pra pegar tráfego de fim
de semana.

- [ ] Migration: adicionar `boost_payments.start_at DateTime
      NULL` (NULL = começar imediatamente).
- [ ] Lógica: ao webhook MP confirmar pagamento, se
      `start_at > now`, NÃO seta `boostUntil` agora. Cron job
      verifica `start_at <= now AND boostUntil < now` e ativa.
- [ ] Service `agendarBoost(userId, durationDays, startAt)`.
- [ ] UI no `/acompanhante/boost`: opção "Começar agora" ou
      "Programar para...".
- [ ] Cleanup noturno ativa boosts agendados que chegaram a hora.

### ⬜ T10 — Stats avançados
**Esforço**: ~5h.
Gráficos detalhados no painel da Acompanhante: visualizações
por hora do dia / dia da semana / origem (busca / direct /
link compartilhado), top mídias mais curtidas, conversão
(visualização → clique no WhatsApp).

- [ ] Migration: adicionar colunas em `profile_daily_stats`
      pra agregar por `hora_do_dia` (24 buckets) e
      `origem` (enum: BUSCA / HOME / DIRECT / COMPARTILHADO).
- [ ] `incrementarVisualizacao` recebe contexto (referrer
      header).
- [ ] Service `obterStatsAvancadas(userId, dias)` agrega.
- [ ] UI: tabs internas em `EstatisticasTab` (Geral /
      Horários / Origens / Top mídias).
- [ ] Reusa `BarChart` pra horários, novo `Heatmap` (7×24)
      pra dia × hora.

### ⬜ T11 — Compartilhamento social com card-imagem
**Esforço**: ~4h.
Botão "Compartilhar" gera uma imagem-card (estilo Spotify
Wrapped) com foto + nome + cidade + selos. Útil pra postar
em Instagram Story / WhatsApp Status.

- [ ] Endpoint `GET /api/acompanhantes/[slug]/share-card.png`
      gera PNG via `sharp` compositando template + foto.
      Cacheable (ETag).
- [ ] Botão "Compartilhar" no perfil público que abre menu
      nativo (`navigator.share`) com imagem + URL + texto.
- [ ] Fallback (browsers sem `share`): copia link + abre
      modal mostrando o card-imagem.

### ⬜ T12 — i18n (pt-BR / es / en)
**Esforço**: ~8h.
Suporte multilíngue. Brasil tem turistas que pesquisam em
inglês/espanhol; também útil pra atender expatriados.

- [ ] Estrutura: `src/i18n/{pt-BR,es,en}.ts` com chaves
      tipadas.
- [ ] Helper `t(key)` server-side + hook `useT()` client.
- [ ] Detecta locale via `Accept-Language` header + cookie
      override (`pv_locale`).
- [ ] Switcher de idioma no rodapé.
- [ ] Migrar todas strings hardcoded pt-BR (centenas de
      chaves — vai em iterações). Começar pelo crítico
      (botões, validação, header).

---

## Longo prazo

### ⬜ T13 — A11y deep-dive
**Esforço**: ~6h.
Acessibilidade WCAG AA. Útil pra usuários com deficiência
visual, idosos, navegação por teclado, e SEO.

- [ ] Foco trap em todos os modais (Modal já tem; auditar
      casos de modal-em-modal).
- [ ] Skip-to-content link invisível no topo do AppShell.
- [ ] aria-live em InlineAlert (anuncia erro pra leitor de
      tela).
- [ ] Contraste: validar `accent-deep` em texto pequeno.
      Ajustar se falhar AA.
- [ ] Adicionar `axe-core/playwright` ao CI.
- [ ] Audit manual com VoiceOver (macOS) / NVDA (Windows).

### ⬜ T14 — Mapa interativo
**Esforço**: ~6h.
Tab "Mapa" na busca com pins agrupados por cidade/bairro.
Útil pra cliente que quer "perto de mim".

- [ ] Adotar Maplibre GL (open-source, sem token) com
      tiles do MapTiler ou OSM.
- [ ] Migration: adicionar `acompanhante_profiles.lat,lng
      DOUBLE PRECISION NULL` (geocodificar via Overpass do
      bairro/cidade ao salvar).
- [ ] Component `BuscaMapa` com clusters (Mapbox/Maplibre
      tem helper).
- [ ] Toggle Lista/Mapa no header da busca.
- [ ] Botão "Usar minha localização" (geolocation API).

### ⬜ T15 — Verificação ao vivo
**Esforço**: ~12h+.
Chamada de vídeo curta (~30s) com admin pra confirmar
identidade real (anti-deepfake).

⚠️ **Depende de SDK externo pago** (Daily.co / Twilio Video /
Whereby). Custo: ~$0.005/min/participante. Volume baixo
no MVP, OK.

- [ ] Adotar Daily.co (mais barato, API simples).
- [ ] Migration: adicionar `verifications.live_session_id,
      live_session_at`.
- [ ] Acompanhante agenda chamada via UI (calendário com
      slots de admin).
- [ ] Service `agendarVerificacaoAoVivo`.
- [ ] Página dedicada `/admin/verificacoes/live/[id]` com
      iframe Daily + botão "Aprovar+ / Rejeitar".
- [ ] Selo "Verificada+" diferenciado (anel dourado em vez
      de salmão).

---

## Convenções da implementação

Cada task respeita:

1. **Server-only logic** em `src/server/`.
2. **Validação dupla** Zod + `validar*` helper.
3. **Primitivos sem domain leak** (`scripts/lint-primitives.ts`).
4. **Transações atômicas** quando há side effects entre tabelas.
5. **Rate limit** em endpoints de criação (LIMITS centralizado).
6. **Testes**: pelo menos 1 unit em cada novo service.
7. **Doc**: comentário JSDoc no topo de cada arquivo novo
   explicando intenção e tradeoffs.
8. **Ordem de commit**: 1 task = 1 commit grande.

## Status global

- 5 / 15 concluídas (T01, T02, T03, T04, T05).
- Estimativa total: ~67h.
- Bloqueadores externos: T15 depende de SDK pago.
