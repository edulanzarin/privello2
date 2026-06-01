# Biblioteca de Componentes — Privello

Documentação canônica dos primitivos da Privello. Tudo é importado por
um único ponto de entrada: `@/components`.

> Não importe direto de `@/components/primitives/<arquivo>`. O barrel
> `src/components/index.ts` é a fronteira pública.

**Status atual**: 47 primitivos, 0 vazamento de domínio (validado por
`scripts/lint-primitives.ts`), 0 erro de TypeScript em `src/`.

## Sumário

1. [Princípios](#princípios)
2. [Tokens e tema](#tokens-e-tema)
3. [Hierarquia visual de páginas](#hierarquia-visual-de-páginas)
4. [Catálogo de primitivos](#catálogo-de-primitivos)
   - [Layout e estrutura](#layout-e-estrutura)
   - [Tipografia e identidade](#tipografia-e-identidade)
   - [Formulários](#formulários)
   - [Ações e botões](#ações-e-botões)
   - [Listagem e dados](#listagem-e-dados)
   - [Indicadores e selos](#indicadores-e-selos)
   - [Mídia](#mídia)
   - [Modais e overlays](#modais-e-overlays)
   - [Navegação](#navegação)
   - [Onboarding e ofertas](#onboarding-e-ofertas)
   - [Feedback e estado vazio](#feedback-e-estado-vazio)
   - [Ícones](#ícones)
5. [Composições de alto nível](#composições-de-alto-nível)
6. [Padrões de uso](#padrões-de-uso)
7. [Backend de mídia](#backend-de-mídia)
8. [Páginas vivas](#páginas-vivas)

## Princípios

- **Primitivo primeiro.** Sempre que um padrão visual aparecer em mais
  de um lugar, ele vira primitivo. Linhas como `inline-flex items-center
  gap-1.5 rounded-md border ...` espalhadas pelas pages são red flag.
- **Sem domínio dentro de primitivos.** O lint
  `scripts/lint-primitives.ts` proíbe os tokens `cliente`,
  `acompanhante`, `plano`, `basico`, `premium` em qualquer arquivo de
  `src/components/primitives/`. Nomes neutros: `OfferCard` (não
  `PlanoCard`), `MediaItem` (não `Foto`), `ProfilePhotoEditor` etc.
- **Mobile e desktop iguais em qualidade.** Cada primitivo tem
  comportamento responsivo declarado no JSDoc. Filtros segmentados em
  2x2 no mobile, headers que não quebram, pills com truncate.
- **Texto curto e claro.** Sem em-dash em UI text. Use ponto, vírgula
  ou dois pontos.
- **Ícones autorais.** Pack único em `src/components/icons.tsx` —
  stroke 1.25, terminações redondas, alguns com `fill: currentColor`
  + `fillOpacity` pra dar personalidade. Trocar o pack inteiro é
  edição num arquivo.

## Tokens e tema

Fonte de verdade: `src/components/tokens.ts`. Consumido pelo
`tailwind.config.ts` em `theme.extend`.

### Paleta principal

- **`primary`** — salmão suave (escala 50..900). Cor de marca, usada em
  CTAs, hover, focus rings e selos positivos.
  - Destaques canônicos: `primary-400 = #ffaa8a`, `primary-600 = #ec7b5b`.
- **`secondary`** — amarelo dourado, reservado para acentos pontuais.
- **`neutral`** — cinzas (50..900) para superfícies, bordas, divisores.
- **`success`/`warning`/`danger`/`info`** — semânticos.

### Aliases semânticos

- `surface` (`#ffffff`) — superfície sólida (cards, inputs).
- `surfaceMuted` (`neutral-50`) — superfícies "abafadas".
- `background` (`#f5f3ff`) — fundo lavanda do `AppShell`.
- `text.primary/secondary/disabled/inverse` — texto.
- `border` (`neutral-200`) — divisores e contornos.
- `glass.*` — tokens semânticos para superfícies de vidro (rgba +
  shadow). Disponíveis em CSS via `var(--glass-*)`.

### Animações

Em `tailwind.config.ts` keyframes/animation:
- `fade-in` (320ms cubic-bezier) — entrada suave com translateY.
- `fade-in-soft` (200ms ease-out) — só opacidade.
- `pop` (320ms cubic-bezier overshoot) — `LikeButton`.
- `shimmer`, `blob-1`, `blob-2` — heros e skeletons.

### Sombras

- `shadow-sm` (Tailwind default) — cards `default`.
- `shadow-glass` — cards `glass`.
- `shadow-glassLg` — modal cards, oferta destacada.
- `shadow-glow` — focus em hero/destaques.

### Utility CSS

- `.scrollbar-none` — esconde a scrollbar mantendo o scroll. Aplicado
  no `Tabs.TabList` e em qualquer overflow rolável que o Windows
  enfeie com scrollbar fantasma.

## Hierarquia visual de páginas

A regra mental para qualquer página autenticada:

1. **Shell** (lavanda `bg-background`) — fornecido por `AppShell` via
   layouts em `(shell)`, `cliente/`, `acompanhante/`.
2. **`PageSurface`** (salmão muito suave `primary-50/60` com borda
   `primary-200`) — o "container" da página, hospeda o conteúdo.
3. **`Card.default`** (branco com borda fina `neutral-200`) — blocos
   internos do PageSurface. Hospedam listas (InfoRow), descrições,
   estados vazios.

Cada nível tem papel próprio. Sem branco em cima de branco.

## Catálogo de primitivos

### Layout e estrutura

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `AppShell` | `AppShell.tsx` | TopBar + main + BottomNav. Layout-shell de toda a área autenticada. |
| `PageSurface` | `PageSurface.tsx` | Container tonal salmão da página. 3 widths: `sm/md/lg`. |
| `Card` | `Card.tsx` | Bloco interno. Variantes `default` (branco + borda fina), `glass` (translúcido), `elevated` (glass + hover-lift). Prop `padding="none"` remove padding interno (use para listas `divide-y` de InfoRow ou EmptyState). |
| `AuthCard` | `AuthCard.tsx` | Surface branco para páginas públicas (`/login`, `/cadastro`, onboarding). Default `maxWidth="lg"`. |
| `Tabs` + `TabList`/`TabTrigger`/`TabPanel` | `Tabs.tsx` | Composto headless ARIA. `urlHash` opcional sincroniza com `#hash`. |
| `SectionHeader` | `SectionHeader.tsx` | Cabeçalho compacto: ícone tonal + título + subtítulo + slot `trailing`. |

### Tipografia e identidade

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `Logo` | `Logo.tsx` | Marca da Privello. Variantes `mark` (só ícone) e `full` (ícone + nome). |
| `TopBar` | `TopBar.tsx` | Barra superior com Logo centralizado e slots `leading`/`trailing`. |
| `Avatar` | `Avatar.tsx` | Foto circular com fallback de iniciais. 4 tamanhos. Aceita `onClick`, `cornerBadge`, `cornerBadgeTone`. |
| `ProfileHeader` | `ProfileHeader.tsx` | Header identitário: avatar + nome + identificador + slots `badge`/`actions`/`extras`/`avatarCornerBadge`. Sempre em linha. |

### Formulários

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `Input` | `Input.tsx` | `<input>` estilizado, leadingIcon, errorMessage, hint. |
| `PasswordInput` | `PasswordInput.tsx` | Estende `Input` com toggle de eye/eye-off. |
| `Select` | `Select.tsx` | Combobox custom usando `ComboboxDropdown`. Pixel-igual aos autocompletes de cidade/bairro. |
| `ComboboxDropdown` | `ComboboxDropdown.tsx` | Painel rolável de opções compartilhado pelo `Select` e por inputs com sugestões. |
| `ComboboxOption` | `ComboboxOption.tsx` | Linha clicável dentro do dropdown. Hover `bg-primary-50`. |
| `Switch` | `Switch.tsx` | Toggle binário (sim/não). Default `false` deixa visualmente "não". |
| `ChipGroup` | `ChipGroup.tsx` | Multi-select por pílulas (idiomas, tags). |
| `FileUpload` | `FileUpload.tsx` | Área de upload simples com drop visual. Ainda usado em fluxos sem preview. |
| `AvatarUpload` | `AvatarUpload.tsx` | Wrapper específico de upload de Foto_de_Perfil no onboarding (preview circular + crop visual). |

### Ações e botões

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `Button` | `Button.tsx` | Botão padrão. Variantes `primary/secondary/ghost/danger`. Tamanhos `sm/md/lg`. Suporta `loading`. Aceita `href` e renderiza `<a>` com o mesmo visual quando precisa virar CTA de navegação. |
| `LinkButton` | `LinkButton.tsx` | Botão pequeno em forma de link com borda fina. Tons `neutral/danger`. Prop `collapseToIcon` colapsa para ícone-só em mobile. |
| `IconButton` | `IconButton.tsx` | Botão circular puramente icônico (FAB-style). Tons `primary/neutral/danger/ghost`. Tamanhos `sm/md/lg`. |
| `LogoutButton` | `LogoutButton.tsx` | Logout completo. Dispara `POST /api/auth/logout`, redireciona. Variantes `row` e `button`. |
| `LikeButton` | `LikeButton.tsx` | Toggle de curtir com contador. Animação `pop` no clique. |

### Listagem e dados

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `InfoRow` | `InfoRow.tsx` | Linha "ícone + rótulo + valor + ação". Estados: read-only, editable (lápis no hover, `editHref`/`onEdit`), `locked` (cadeado + `lockedReason`). |
| `ActivityFeed` + `ActivityFeedItem` | `ActivityFeed.tsx` | Feed denso estilo timeline. Item tem ícone, título, subtítulo, trailing, opcional `href`. |
| `MetricPill` | `MetricPill.tsx` | Métrica em pílula horizontal compacta (ícone + valor + rótulo). Padrão de KPI em painéis e cabeçalhos. |
| `Card` | `Card.tsx` | Já listado. Hospeda listas de InfoRow via `<Card padding="none"><ul className="divide-y">...`. Quando a lista é toda de InfoRows, prefira `InfoList` que já vem montado. |
| `InfoList` | `InfoList.tsx` | Lista densa de InfoRows. Wrappa cada filho em `<li>` automático e aplica `divide-y`. Substitui o padrão `<Card padding="none"><ul divide-y>{InfoRow...}</ul></Card>` repetido nos painéis. |

### Indicadores e selos

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `Badge` | `Badge.tsx` | Selo curto em pílula uppercase. Tons `primary/neutral/primaryGradient`. Suporta `icon`. |
| `Avatar` (cornerBadge) | `Avatar.tsx` | Selo redondo no canto inferior direito do avatar. Indica tier (Premium/Fan) sem ocupar espaço próximo ao nome. |
| `StepProgress` | `StepProgress.tsx` | Barra de progresso para fluxos multi-step (onboarding). |

### Mídia

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `MediaTypes.ts` | tipos | `MediaItem` (id/type/url/posterUrl/description/likes/liked/comments) e `MediaComment`. |
| `MediaThumbnail` | `MediaThumbnail.tsx` | Tile clicável de mídia em grade. Badge play em vídeos, stats overlay. |
| `MediaGrid` | `MediaGrid.tsx` | Grid responsivo (3-5 colunas) de thumbnails. |
| `MediaCarousel` + `useMediaCarousel` | `MediaCarousel.tsx` | Modal de viewer (foto/vídeo) com lista de comentários e LikeButton no toolbar. Construído sobre `Modal size="xl"`. |
| `MediaUpload` | `MediaUpload.tsx` | Área de drop com preview ao vivo. Auto-detecta foto/vídeo, limites configuráveis, blob URL com auto-revoke. |
| `MediaUploadModal` | `MediaUploadModal.tsx` | Modal de upload (Modal + MediaUpload + textarea descrição + footer). Reutilizável em galeria, foto de perfil, Reels. |
| `Comment` + `CommentInput` | `Comment.tsx` | Linha de comentário com avatar pequeno + autor + tempo + corpo. Input redondo com botão "Enviar". |

### Modais e overlays

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `Modal` + `useModal` | `Modal.tsx` | Base genérica. Tamanhos `sm/md/lg/xl/full`. Backdrop tons `default/strong`. Opcional `dismissOnBackdrop`, `dismissOnEsc`, `showCloseButton`, `title`/`subtitle`. Trava scroll do body, fade-in. |
| `MediaCarousel` | (acima) | Modal especializado em viewer de mídia. |
| `MediaUploadModal` | (acima) | Modal especializado em upload. |
| `ProfilePhotoEditor` | `ProfilePhotoEditor.tsx` | ProfileHeader + LinkButton "Alterar foto" + MediaUploadModal (`accept="photo"`, sem descrição). Faz `POST /api/conta/foto` por padrão. |

### Navegação

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `BottomNav` | `BottomNav.tsx` | Barra inferior persistente. Item ativo recebe `aria-current="page"`. Match por prefixo ou `match: string[]` explícito. |
| `Tabs` | (acima) | Para troca de seções dentro de uma mesma página. |
| `IconSegmented` | `IconSegmented.tsx` | Segmented control puramente icônico (estilo iOS). Faixa única com pill flutuante no segmento ativo. Counter inline opcional. |
| `FilterChips` | `FilterChips.tsx` | Conjunto de pílulas de filtro com texto. Suporta `locked` (cadeado + callback). Layouts `wrap` (padrão) e `fixed` (2x2 mobile, fila desktop). |

### Onboarding e ofertas

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `OfferCard` | `OfferCard.tsx` | Cartão de oferta para telas de comparação de planos. Variante `recommended` aplica `featured`. Reusa `Badge` `primaryGradient`. |
| `OfferLayout` | `OfferLayout.tsx` | Container das telas de seleção de oferta (header + grid de OfferCards). |
| `OptionCard` | `OptionCard.tsx` | Card vertical clicável de escolha (Cliente/Acompanhante no `/cadastro`). 3 tons. |
| `UpgradeBanner` | `UpgradeBanner.tsx` | Banner horizontal de upgrade. Mobile vira coluna. |

### Feedback e estado vazio

| Primitivo | Arquivo | Para quê |
|---|---|---|
| `EmptyState` | `EmptyState.tsx` | Bloco padrão "ícone + título + descrição + ação". Tamanhos `sm/md`. |
| `InlineAlert` | `InlineAlert.tsx` | Mensagem inline com `role="alert"`. Tons `danger/warning/info/success`. Substitui o padrão repetido `<p role="alert" className="rounded-md border border-... bg-.../40 ...">`. |
| `Badge`/`MetricPill`/`StatCard` | (acima) | Estados positivos. |

### Ícones

Pack autoral em `src/components/icons.tsx`. Todos com `viewBox 24x24`,
stroke 1.25, exportados também via barrel.

**Identidade & contato**: `MailIcon`, `AtIcon`, `LockIcon`, `EyeIcon`,
`EyeOffIcon`, `UserIcon`, `UsersIcon`, `PhoneIcon`, `MapPinIcon`.

**Marca/destaque**: `HeartIcon`, `SparklesIcon`, `StarIcon`,
`CrownIcon`, `DiamondIcon`, `FlameIcon`.

**Setas e estados**: `ArrowRightIcon`, `CheckIcon`, `ChevronLeftIcon`,
`ChevronRightIcon`, `XIcon`.

**Ações**: `PencilIcon`, `PlusIcon`, `PlusCircleIcon`.

**Conversa**: `ChatIcon`.

**Mídia**: `MicIcon`, `HomeIcon`, `PlayCircleIcon`, `PlayIcon`,
`ImageIcon`, `CameraIcon`.

> Manter o pack inline (sem dependência tipo `lucide-react`) reduz
> bundle, dá controle total de stroke/peso e permite mudar identidade
> visual editando um arquivo.

## Composições de alto nível

Compostos client-only que combinam vários primitivos:

| Composto | Arquivo | Composição |
|---|---|---|
| `ProfilePhotoEditor` | `ProfilePhotoEditor.tsx` | `ProfileHeader` + `LinkButton` (Alterar foto) + `MediaUploadModal` (`accept="photo"` + `showDescription={false}`). Por default envia para `POST /api/conta/foto` e dispara `router.refresh()`. |
| `MediaCarousel` | `MediaCarousel.tsx` | `Modal size="xl"` + `LikeButton` + `Comment[]` + `CommentInput` + setas/teclado. |
| `MediaUploadModal` | `MediaUploadModal.tsx` | `Modal size="md"` + `MediaUpload` + textarea (com counter) + footer com `Button` Cancelar/Publicar. |
| `LogoutButton` | `LogoutButton.tsx` | Variant `button` reusa `LinkButton tone="danger"`; variant `row` reusa o layout do `InfoRow` com tom danger. |

## Padrões de uso

### Página autenticada típica

```tsx
return (
    <PageSurface>
        <ProfilePhotoEditor
            photoUrl={perfil.fotoUrl}
            name={perfil.nome}
            identifier={`@${perfil.identificador}`}
            avatarCornerBadge={isPremium ? <HeartIcon size={11} /> : null}
            actions={<LogoutButton variant="button" />}
        />

        {/* 3 métricas em pílula */}
        <div className="grid grid-cols-3 gap-2">
            <MetricPill icon={<UsersIcon size={11} />} value="—" label="visualizações" />
            <MetricPill icon={<HeartIcon size={11} />} value="—" label="contatos" />
            <MetricPill icon={<SparklesIcon size={11} />} value="0/50" label="mídias" />
        </div>

        <Tabs defaultValue="perfil" urlHash className="flex flex-col gap-5">
            <TabList aria-label="Áreas do painel">
                <TabTrigger value="perfil">Perfil</TabTrigger>
                <TabTrigger value="midias">Mídias</TabTrigger>
            </TabList>
            <TabPanel value="perfil">
                {/* Conteúdo */}
            </TabPanel>
        </Tabs>
    </PageSurface>
);
```

### Lista densa de campos editáveis

```tsx
<Card className="!p-0">
    <ul className="divide-y divide-neutral-100">
        <li>
            <InfoRow
                icon={<UserIcon size={14} />}
                label="Nome"
                value={perfil.nome}
                editHref="/conta/nome"
            />
        </li>
        <li>
            <InfoRow
                icon={<MailIcon size={14} />}
                label="Email"
                value={perfil.email}
                locked
                lockedReason="O email não pode ser alterado."
            />
        </li>
    </ul>
</Card>
```

### Galeria + carrossel

```tsx
const carousel = useMediaCarousel();

<MediaGrid items={items} onOpen={carousel.openAt} />
<MediaCarousel
    items={items}
    activeId={carousel.activeId}
    onActiveChange={carousel.openAt}
    open={carousel.open}
    onClose={carousel.close}
    comments={commentsByMediaId}
    onToggleLike={(mediaId, liked) => fetch(`/api/likes`, ...)}
    onAddComment={(mediaId, text) => fetch(`/api/comments`, ...)}
/>
```

### Upload modal

```tsx
const upload = useModal();
const [uploading, setUploading] = React.useState(false);

<IconButton onClick={upload.open} icon={<PlusIcon size={20} />} aria-label="Adicionar" tone="primary" />

<MediaUploadModal
    open={upload.isOpen}
    onClose={upload.close}
    submitting={uploading}
    onSubmit={async (result) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("foto", result.file);
            fd.append("description", result.description);
            const res = await fetch("/api/...", { method: "POST", body: fd });
            if (!res.ok) { /* trata erro */ return; }
            upload.close();
            router.refresh();
        } finally { setUploading(false); }
    }}
/>
```

### Filtro segmentado puramente icônico

```tsx
<IconSegmented
    options={[
        { value: "tudo", label: "Tudo", icon: <SparklesIcon size={14} />, count: totals.total },
        { value: "fotos", label: "Fotos", icon: <ImageIcon size={14} />, count: totals.fotos },
        { value: "videos", label: "Vídeos", icon: <PlayIcon size={14} />, count: totals.videos },
    ]}
    value={filtro}
    onChange={setFiltro}
    aria-label="Filtrar tipo"
/>
```

## Backend de mídia

### Endpoints

| Método + path | Para quê |
|---|---|
| `POST /api/conta/foto` | Troca a Foto_de_Perfil do usuário autenticado. Aceita Cliente e Acompanhante. Multipart com campo `foto`. Resolve sessão via cookie. |
| `POST /api/cadastro/cliente/foto` | Stage da Foto_de_Perfil durante cadastro de Cliente (sem sessão). Devolve `stagedKey` que vira input do submit do form. |
| `POST /api/acompanhante/midias` | Publica nova mídia na galeria. Multipart com `foto` (image/video) + `description` (opcional). Valida limite do plano. |
| `POST /api/auth/login` | Login. Define cookie HMAC. |
| `POST /api/auth/logout` | Encerra sessão. Idempotente. |
| `GET /api/storage/[...key]` | Dev-only. Serve arquivos de `.storage/`. Em produção, R2 presigned URLs. |
| `GET /api/check-availability` | Verifica disponibilidade de email/identificador. |
| `GET /api/localidades/{estados,cidades,bairros}` | IBGE/Overpass com cache no Postgres. |

### Server functions de storage

| Função | Arquivo | Para quê |
|---|---|---|
| `stageProfilePhoto` | `server/storage/profileMedia.ts` | Valida MIME/tamanho via `validarFotoPerfil`, sobe `staged/<uuid>` no R2. |
| `commitProfilePhoto` | `server/storage/profileMedia.ts` | Promove staged → final com retry e fallback `PENDING_REPAIR`. |
| `cleanupStaged` | `server/storage/profileMedia.ts` | Apaga staged órfão (best-effort). |
| `replaceProfilePhoto` | `server/storage/replaceProfilePhoto.ts` | Stage + transação atômica (cria nova Media, atualiza `*Profile.fotoPerfilId`, marca antiga como `DELETED`) + commit. |
| `publicarMidia` | `server/storage/galleryMedia.ts` | Stage + transação (checa limite do plano + cria Media com `kind` + descrição) + commit. |
| `listarGaleria` | `server/storage/galleryMedia.ts` | Lê mídias `COMMITTED` não-perfil ordenadas por recência. |

### Cliente R2

`src/lib/storage/r2.ts` — interface `R2Client` com `putStaged`,
`commit`, `deleteObject`, `presignedUrl`. Em dev, retorna client local
que grava em `.storage/`. Em produção, usa AWS SDK contra Cloudflare
R2 (region `auto`, S3-compatível).

**Property 32 (Requirement 7.7)**: nenhum outro arquivo da plataforma
importa `@aws-sdk/*`. Toda IO de objeto passa por `r2.ts`.

### Validação de domínio

`src/domain/validation/`:

- `validarFotoPerfil` — JPEG/PNG/WEBP até 10 MiB.
- `validarGaleriaMidia` + `classificarMidia` — fotos (10 MiB) e vídeos
  MP4/WEBM/MOV (80 MiB).
- `validarGaleriaDescricao` — até 280 chars após trim.
- Demais: `email`, `identificador`, `nome`, `senha`, `telefone`,
  `descricao`.

## Páginas vivas

Mapa de rotas + composições usadas:

| Rota | Tipo | Layout | Composições principais |
|---|---|---|---|
| `/` | Pública (com Shell) | `(shell)/layout.tsx` | `PageSurface width="sm"` + `EmptyState`. |
| `/acompanhantes` | Pública (com Shell) | (shell) | `PageSurface` + `EmptyState`. Stub. |
| `/reels` | Pública (com Shell) | (shell) | `PageSurface` + `EmptyState`. Stub. |
| `/login` | Pública | (sem shell) | `AuthCard` + `Input` + `PasswordInput`. |
| `/cadastro` | Pública | (sem shell) | `AuthCard` + 2 `OptionCard` (Cliente/Acompanhante). |
| `/cadastro/cliente` | Pública | (sem shell) | `AuthCard` + form completo. |
| `/cadastro/acompanhante/[step]` | Pública multi-step | (sem shell) | `AuthCard` + `StepProgress` + step específico. |
| `/cliente` | Privada Cliente | `cliente/layout.tsx` (AppShell) | `PageSurface` + `ProfilePhotoEditor` + 3 `MetricPill` + `Tabs` (Perfil/Atividade/Configurações). |
| `/cliente/selecao-plano` | Privada Cliente | (AppShell desliga) | `OfferLayout` + `OfferCard[]`. |
| `/acompanhante` | Privada Acompanhante | `acompanhante/layout.tsx` (AppShell, BottomNav 2 abas) | `PageSurface` + `ProfilePhotoEditor` (corner badge se Premium) + 3 `MetricPill` + `Tabs` (Perfil/Mídias/Áudio?/Configurações). |
| `/acompanhante/selecao-plano` | Privada Acompanhante | (mesma) | `OfferLayout` + `OfferCard[]`. |
| `/acompanhantes/[slug]` | Pública | (futuro) | `MediaGrid` + `MediaCarousel` (pública). |

### Tabs do `/acompanhante`

- **Perfil** (`_painel/PerfilTab.tsx`): `SectionHeader` (Descrição, com
  botão Editar via `LinkButton collapseToIcon`) + `Card` com texto +
  `SectionHeader` (Dados do perfil) + `Card !p-0` com lista de
  `InfoRow` (Nome editável, @ locked, Localização editável, Telefone
  editável, Email locked).
- **Mídias** (`_painel/MidiasTab.tsx`): `SectionHeader` (Galeria) com
  trailing `IconSegmented` (Tudo/Fotos/Vídeos) + `IconButton +` que
  abre `MediaUploadModal`. 3 `MetricPill` (mídias, curtidas,
  comentários). `MediaGrid` ou `EmptyState` por filtro. Bloco Stories
  com `EmptyState` ou bloqueio por plano. `MediaCarousel` plugado.
- **Áudio** (`_painel/AudioTab.tsx`): `SectionHeader` + `EmptyState`
  (placeholder até `Sistema_de_Audio_de_Apresentacao`).
- **Configurações** (`_painel/ConfiguracoesTab.tsx`): `SectionHeader`
  (Conta) + `Card !p-0` com `InfoRow` (Email locked, Senha editável) +
  `SectionHeader` (Plano) + `Card !p-0` com `InfoRow` (Plano atual com
  `Badge`, Mudar plano).

### Tabs do `/cliente`

- **Perfil**: `Card !p-0` + lista `InfoRow` (Nome editável, @ locked,
  Email locked).
- **Atividade**: `UpgradeBanner` (se Grátis) + `FilterChips
  layout="fixed"` (Tudo/Avaliações/Curtidas-locked/Comentários-locked)
  + `ActivityFeed` com `EmptyState`.
- **Configurações**: igual à da Acompanhante (Conta + Plano).

## Como adicionar um primitivo novo

1. Cria `src/components/primitives/SeuPrimitivo.tsx`. Não pode usar
   tokens de domínio (cliente/acompanhante/plano/basico/premium).
2. Adiciona `export` no `src/components/index.ts`.
3. Roda `npm run lint:primitives` para confirmar.
4. Documenta neste arquivo na seção apropriada.
5. Se substitui um padrão existente, faz sweep nos call-sites e usa o
   `IconButton`/`LinkButton`/etc. correspondente ao novo primitivo.

## Estado atual

- 47 primitivos, 1 ícone pack (31 ícones + helper SVG wrapper).
- 4 compostos client-only.
- 100% das telas autenticadas usam `PageSurface` + `Card.default`.
- 0 erro de TypeScript em `src/`.
- 0 vazamento de domínio (lint passa).
- 0 duplicação de "selo pílula" (todas via `Badge`).
- 0 botão `<a>` ou `<button>` Tailwind hand-rolled em pages para
  ações secundárias (todos via `LinkButton` ou `IconButton`).
- 1 `Modal` base, 2 modais especializados (`MediaUploadModal`,
  `MediaCarousel`).

## Próximas extrações naturais

À medida que o produto crescer, esses padrões viram primitivo:

- **`DangerConfirmModal`** — confirmação destrutiva ("Excluir conta",
  "Apagar mídia"). `Modal size="sm"` + ícone danger + 2 botões.
- **`Toast` / `Notification`** — feedback efêmero. Hoje usamos
  inline message no subtitle dos modais.
- **`Skeleton`** — placeholder durante fetch. Tailwind anim
  `shimmer` já existe.
- **`MediaCarouselFullVertical`** — variante de Reels (mídia full-screen,
  swipe vertical). Construir sobre `MediaCarousel` com props extras.
- **`ReviewCard`** — avaliação de Cliente para Acompanhante. Vai
  combinar `Avatar`, `RatingStars`, `Comment`.
