import type { Metadata } from "next";

import {
    Button,
    Card,
    EmptyState,
    EyeOffIcon,
    PageSurface,
    ProfileBanner,
    UsersIcon,
} from "@/components";
import { obterPerfilPublico } from "@/server/acompanhante-profile";
import { contarLikesTotais } from "@/server/acompanhante-profile/likesTotal";
import { getCurrentSession } from "@/server/auth/currentSession";
import { obterPerfilCliente } from "@/server/cliente-profile";
import { isFavorito } from "@/server/favorites";
import { obterLikesDoViewer } from "@/server/media-interactions";
import {
    listarGaleria,
    toMediaItem,
} from "@/server/storage/galleryMedia";
import { listarDestaquesPublicos, listarStoriesDoDestaque } from "@/server/storage/highlights";
import {
    listarStoriesAtivosDoPerfil,
} from "@/server/storage/storyMedia";
import { listarTopicAudios } from "@/server/storage/topicAudio";
import { listarPerguntasPublicas } from "@/server/questions";
import {
    listarReviewsPublicos,
    obterMinhaReview,
} from "@/server/reviews";

import { PerfilPublicoView } from "./_perfilPublico/PerfilPublicoView";
import { ViewTracker } from "./_perfilPublico/ViewTracker";

/**
 * Página pública do perfil de uma Acompanhante (`/acompanhantes/[slug]`).
 *
 * O `slug` é o `User.identificador` (parte após o `@`). A função
 * {@link obterPerfilPublico} resolve o estado discriminado:
 *
 * - `NOT_FOUND` — não existe Acompanhante com esse identificador.
 *   Tela "perfil não encontrado" com link de volta para a busca.
 * - `HIDDEN` — perfil existe mas está oculto. Engloba dois cenários
 *   indistinguíveis para o visitante:
 *     1. A Acompanhante desligou a visibilidade no painel.
 *     2. O plano vigente é nulo (expirado ou nunca selecionado).
 *   Em ambos, mostramos a mesma tela "perfil indisponível".
 * - `OK` — perfil disponível com a página completa renderizada por
 *   {@link PerfilPublicoView}.
 *
 * # PII
 *
 * O `obterPerfilPublico` retorna um {@link PerfilAcompanhantePublico}
 * sem PII (sem email, sem telefone, sem userId interno). O telefone
 * só vira `whatsappUrl` derivada server-side. O `userId` vem em
 * campo separado da resposta `OK` para usos internos da page (galeria
 * e contador de views) e não é repassado ao componente cliente.
 *
 * # Métricas
 *
 * Cada acesso ao perfil dispara o {@link ViewTracker} (client) que
 * faz `POST /api/acompanhantes/[slug]/view` no mount, com cooldown
 * de 6h por viewer via cookie HTTP-only. O próprio dono não conta
 * na métrica. Não fazemos isso no RSC porque o Next 15 proíbe
 * `cookies().set()` durante o render.
 */
export default async function PerfilPublicoPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const result = await obterPerfilPublico(slug);

    if (result.state === "NOT_FOUND") {
        return (
            <PageSurface verticalAlign="center">
                <Card padding="none">
                    <EmptyState
                        icon={<UsersIcon size={20} />}
                        title="Perfil não encontrado"
                        description="O link que você abriu não corresponde a nenhum perfil ativo. Confira se o nome de usuário está certo."
                        action={
                            <Button href="/acompanhantes" size="sm">
                                Ver todas
                            </Button>
                        }
                    />
                </Card>
            </PageSurface>
        );
    }

    if (result.state === "HIDDEN") {
        return (
            <PageSurface verticalAlign="center">
                <Card padding="none">
                    <EmptyState
                        icon={<EyeOffIcon size={20} />}
                        title="Este perfil está oculto ou desativado"
                        description="No momento, este perfil não está disponível para visualização."
                        action={
                            <Button href="/acompanhantes" size="sm">
                                Ver outros perfis
                            </Button>
                        }
                    />
                </Card>
            </PageSurface>
        );
    }

    // result.state === "OK". Resolvemos em paralelo:
    //   - galeria pública (com agregados de likes/comments)
    //   - sessão atual (pra pré-popular form de avaliação do Cliente)
    //   - lista de reviews públicas
    //   - lista de perguntas públicas
    //   - total de curtidas (foto + galeria + stories)
    const [galeria, session, reviewsAll, perguntasAll, likesTotal] =
        await Promise.all([
            listarGaleria(result.userId),
            getCurrentSession(),
            listarReviewsPublicos(result.userId),
            listarPerguntasPublicas(result.userId),
            contarLikesTotais(result.userId),
        ]);

    // Stories ativos do dono — uma única query traz a lista
    // completa com flags `viewed`/`liked` por story. O estado do
    // ring (unseen/seen/none) é derivado em memória — sem precisar
    // de uma query separada como `obterStoryRingState` (que
    // duplicava a leitura).
    const storiesAtivos = await listarStoriesAtivosDoPerfil(result.userId, {
        viewerUserId: session?.userId ?? null,
    });
    const storyRingTotal = storiesAtivos.length;
    const storyRingNaoVistos = storiesAtivos.filter((s) => !s.viewed).length;

    // Plano do viewer Cliente — define se ele pode curtir/comentar.
    // Acompanhante e anônimo não interagem.
    const viewerClienteProfile =
        session?.userType === "CLIENTE"
            ? await obterPerfilCliente(session.userId)
            : null;
    const viewerIsFan = viewerClienteProfile?.planoVigente === "FAN";

    // Anônimo OU Cliente Grátis veem **uma prévia** (1 item) de
    // avaliações, perguntas e comentários — o resto fica gated com
    // blur e CTA. Padrão tipo LinkedIn: dá um gostinho do conteúdo
    // pra incentivar a compra do Fan.
    //
    // Acompanhante (Owner ou outra) vê normal.
    const canSeeFanContent =
        session?.userType === "ACOMPANHANTE" || viewerIsFan;
    const reviews = canSeeFanContent ? reviewsAll : reviewsAll.slice(0, 1);
    const perguntasFull = canSeeFanContent
        ? await listarPerguntasPublicas(result.userId, {
            viewerUserId: session?.userId ?? null,
        })
        : perguntasAll;
    const perguntas = canSeeFanContent
        ? perguntasFull
        : perguntasFull.slice(0, 1);
    const perguntasCount = perguntasFull.length;

    const perfilSafe = result.perfil;

    // Re-popular minhaReview agora vira uma busca por comentário (sem
    // nota numérica).
    const minhaReview =
        session?.userType === "CLIENTE" && viewerIsFan
            ? await obterMinhaReview(result.userId, session.userId)
            : null;

    // Marca quais mídias da galeria o viewer já curtiu (apenas Fan;
    // Grátis e anônimos veem 0 curtidas próprias).
    const galeriaIds = galeria.map((g) => g.id);
    const likedSet = viewerIsFan
        ? await obterLikesDoViewer(galeriaIds, session?.userId ?? null)
        : new Set<string>();

    // Converte com `liked` per-viewer.
    const galeriaItems = galeria.map((row) => ({
        ...toMediaItem(row),
        liked: likedSet.has(row.id),
    }));

    // Estado inicial do "salvar" (bookmark) — apenas Cliente logado
    // pode favoritar Acompanhante. Owner e Acompanhante não veem o
    // botão; passar `null` aqui sinaliza isso.
    const favoritoInicial =
        session?.userType === "CLIENTE"
            ? await isFavorito({
                clientUserId: session.userId,
                acompanhanteUserId: result.userId,
            })
            : null;

    // Stories Highlights (destaques permanentes) — agrupados por
    // título. Aparecem em rail acima da galeria. Lista vazia OK
    // (a maioria dos perfis ainda não tem destaques).
    const destaques = await listarDestaquesPublicos(result.userId);

    // Carrega os stories de cada destaque em paralelo. Volume é
    // baixo (poucos destaques, poucos stories cada). Manter tudo
    // upfront evita round-trip ao abrir o viewer.
    const destaquesComStories = await Promise.all(
        destaques.map(async (d) => {
            const stories = await listarStoriesDoDestaque({
                ownerUserId: result.userId,
                title: d.title,
            });
            return {
                title: d.title,
                total: d.total,
                coverStorageKey: d.coverStorageKey,
                coverKind: d.coverKind,
                coverMediaId: d.coverMediaId,
                stories: stories.map((s) => ({
                    id: s.id,
                    type: s.kind === "VIDEO" ? ("video" as const) : ("photo" as const),
                    url: `/api/storage/${s.storageKey}`,
                    description: s.caption,
                    createdAt: s.createdAt,
                    likes: s.likesCount,
                })),
            };
        }),
    );

    // TopicAudios públicos do perfil — FAQ sonora.
    const topicAudios = await listarTopicAudios(result.userId);

    return (
        <PageSurface
            banner={<ProfileBanner photoUrl={result.perfil.coverUrl} />}
        >
            <ProfileJsonLd
                slug={slug}
                nome={result.perfil.nome}
                cidadeNome={result.perfil.cidadeNome}
                estadoSigla={result.perfil.estadoSigla}
                descricao={result.perfil.descricao}
                fotoUrl={result.perfil.fotoUrl}
                reviews={reviewsAll}
            />
            <ViewTracker slug={slug} />
            <PerfilPublicoView
                slug={slug}
                profileUserId={result.userId}
                perfil={perfilSafe}
                galeriaItems={galeriaItems}
                reviews={reviews}
                perguntas={perguntas}
                perguntasCount={perguntasCount}
                likesTotal={likesTotal}
                storiesAtivos={storiesAtivos.map((s) => ({
                    id: s.id,
                    type: s.kind === "VIDEO" ? "video" : "photo",
                    url: `/api/storage/${s.storageKey}`,
                    description: s.caption,
                    createdAt: s.createdAt,
                    likes: s.likesCount,
                    liked: s.liked,
                    viewed: s.viewed,
                }))}
                storyRing={
                    storyRingTotal === 0
                        ? "none"
                        : storyRingNaoVistos > 0
                            ? "unseen"
                            : "seen"
                }
                viewerKind={
                    session === null
                        ? "anonimo"
                        : session.userType === "CLIENTE"
                            ? "cliente"
                            : "acompanhante"
                }
                viewerIsOwner={
                    session?.userType === "ACOMPANHANTE" &&
                    session.userId === result.userId
                }
                viewerIsFan={viewerIsFan}
                viewerNome={viewerClienteProfile?.nome ?? null}
                viewerFotoUrl={viewerClienteProfile?.fotoUrl ?? null}
                minhaReview={minhaReview}
                favoritoInicial={favoritoInicial}
                destaques={destaquesComStories.map((d) => ({
                    title: d.title,
                    total: d.total,
                    coverUrl: `/api/storage/${d.coverStorageKey}`,
                    coverKind: d.coverKind,
                    coverMediaId: d.coverMediaId,
                    stories: d.stories,
                }))}
                topicAudios={topicAudios.map((t) => ({
                    topicKind: t.topicKind,
                    url: `/api/storage/${t.storageKey}`,
                    mimeType: t.mimeType,
                }))}
            />
        </PageSurface>
    );
}

/**
 * Metadata dinâmica baseada no perfil. Quando o perfil está oculto
 * ou não existe, devolvemos um título genérico **com `noindex`** —
 * páginas indisponíveis não devem aparecer no Google. Quando OK,
 * geramos title + description otimizados pra busca local
 * ("[nome] em [cidade], [UF]"), com OG image apontando pra foto
 * de perfil e canonical absoluta.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const result = await obterPerfilPublico(slug);

    if (result.state !== "OK") {
        return {
            title: "Perfil indisponível",
            robots: { index: false, follow: false },
        };
    }

    const { perfil } = result;
    const localizacao = `${perfil.cidadeNome}, ${perfil.estadoSigla}`;
    const titleShort = `${perfil.nome} em ${localizacao}`;
    const description = perfil.descricao
        ? `${perfil.descricao.slice(0, 155)}…`
        : `Conheça ${perfil.nome}, acompanhante em ${localizacao}. Perfil verificado com fotos, vídeos e avaliações.`;

    // URL absoluta da foto de perfil pra OG/Twitter cards.
    const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const ogImage = perfil.fotoUrl
        ? perfil.fotoUrl.startsWith("http")
            ? perfil.fotoUrl
            : `${siteUrl}${perfil.fotoUrl}`
        : `${siteUrl}/icon.png`;

    return {
        title: titleShort,
        description,
        alternates: {
            canonical: `/acompanhantes/${perfil.identificador}`,
        },
        openGraph: {
            title: `${perfil.nome} · ${localizacao}`,
            description,
            url: `${siteUrl}/acompanhantes/${perfil.identificador}`,
            images: [{ url: ogImage, width: 600, height: 800, alt: perfil.nome }],
            type: "profile",
            locale: "pt_BR",
            siteName: "Privello",
        },
        twitter: {
            card: "summary_large_image",
            title: `${perfil.nome} · ${localizacao}`,
            description,
            images: [ogImage],
        },
    };
}


/**
 * JSON-LD `Person` + `BreadcrumbList` para o perfil público.
 *
 * - **Person**: Google entende que aquela página representa uma
 *   pessoa real. Quando indexar, pode mostrar como knowledge card
 *   (foto, localização). Não declaramos `aggregateRating` porque
 *   removemos a nota numérica do produto.
 * - **BreadcrumbList**: gera a trilha "Home > Acompanhantes > Nome"
 *   no SERP, melhorando CTR.
 *
 * Renderizado server-side direto no HTML — Google parser pega na
 * primeira passada.
 */
function ProfileJsonLd({
    slug,
    nome,
    cidadeNome,
    estadoSigla,
    descricao,
    fotoUrl,
    reviews,
}: {
    slug: string;
    nome: string;
    cidadeNome: string;
    estadoSigla: string;
    descricao: string;
    fotoUrl: string | null;
    /**
     * Reviews públicas pra emitir como `Review` Schema.org. Pegamos
     * até 3 mais recentes pra não inflar o HTML — o Google só
     * mostra ~3 reviews no SERP de qualquer jeito.
     */
    reviews: ReadonlyArray<{
        id: string;
        comment: string;
        rating: number | null;
        createdAt: Date;
        authorNome: string;
    }>;
}): React.ReactElement {
    const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const url = `${siteUrl}/acompanhantes/${slug}`;
    const image = fotoUrl
        ? fotoUrl.startsWith("http")
            ? fotoUrl
            : `${siteUrl}${fotoUrl}`
        : undefined;

    // Agrega ratings numéricos pra `aggregateRating` (rich snippet de
    // estrelas no SERP). Ignora reviews sem nota.
    const ratings = reviews
        .map((r) => r.rating)
        .filter((r): r is number => typeof r === "number");
    const aggregateRating =
        ratings.length > 0
            ? {
                  "@type": "AggregateRating",
                  ratingValue: (
                      ratings.reduce((a, b) => a + b, 0) / ratings.length
                  ).toFixed(1),
                  reviewCount: ratings.length,
                  bestRating: 5,
                  worstRating: 1,
              }
            : undefined;

    // Top 3 reviews pra `review` (exige texto real, não sumário).
    const reviewSchema = reviews.slice(0, 3).map((r) => ({
        "@type": "Review",
        reviewBody: r.comment.slice(0, 500),
        datePublished: r.createdAt.toISOString(),
        author: {
            "@type": "Person",
            name: r.authorNome,
        },
        ...(typeof r.rating === "number"
            ? {
                  reviewRating: {
                      "@type": "Rating",
                      ratingValue: r.rating,
                      bestRating: 5,
                      worstRating: 1,
                  },
              }
            : {}),
    }));

    const person: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Person",
        name: nome,
        url,
        image,
        description: descricao.slice(0, 500),
        address: {
            "@type": "PostalAddress",
            addressLocality: cidadeNome,
            addressRegion: estadoSigla,
            addressCountry: "BR",
        },
    };
    if (aggregateRating) person.aggregateRating = aggregateRating;
    if (reviewSchema.length > 0) person.review = reviewSchema;

    const breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Início",
                item: siteUrl,
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Acompanhantes",
                item: `${siteUrl}/acompanhantes`,
            },
            {
                "@type": "ListItem",
                position: 3,
                name: `${nome} em ${cidadeNome}, ${estadoSigla}`,
                item: url,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }}
            />
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
            />
        </>
    );
}
