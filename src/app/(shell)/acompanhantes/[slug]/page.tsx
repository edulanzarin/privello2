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
import { getCurrentSession } from "@/server/auth/currentSession";
import { obterPerfilCliente } from "@/server/cliente-profile";
import { obterLikesDoViewer } from "@/server/media-interactions";
import {
    listarGaleria,
    toMediaItem,
} from "@/server/storage/galleryMedia";
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
    const [galeria, session, reviewsAll] = await Promise.all([
        listarGaleria(result.userId),
        getCurrentSession(),
        listarReviewsPublicos(result.userId),
    ]);

    // Plano do viewer Cliente — define se ele pode curtir/comentar.
    // Acompanhante e anônimo não interagem.
    const viewerClienteProfile =
        session?.userType === "CLIENTE"
            ? await obterPerfilCliente(session.userId)
            : null;
    const viewerIsFan = viewerClienteProfile?.planoVigente === "FAN";

    // Anônimo OU Cliente Grátis não veem avaliações/comentários
    // detalhados. Recebem lista vazia no payload RSC. Os contadores
    // agregados (`reviewsCount`/`reviewsAverage`) também são zerados
    // pra não vazar a média do perfil pra quem não tem plano.
    //
    // Acompanhante (Owner ou outra) vê normal: precisa enxergar o
    // que estão dizendo dela.
    const canSeeReviews =
        session?.userType === "ACOMPANHANTE" || viewerIsFan;
    const reviews = canSeeReviews ? reviewsAll : [];

    const perfilSafe = canSeeReviews
        ? result.perfil
        : {
            ...result.perfil,
            reviewsCount: 0,
            reviewsAverage: 0,
        };

    // Cliente autenticado vê o estado da própria avaliação para
    // pré-popular o formulário "Sua avaliação". Acompanhantes e
    // anônimos não acessam este caminho.
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

    return (
        <PageSurface
            banner={<ProfileBanner photoUrl={result.perfil.coverUrl} />}
        >
            <ViewTracker slug={slug} />
            <PerfilPublicoView
                slug={slug}
                perfil={perfilSafe}
                galeriaItems={galeriaItems}
                reviews={reviews}
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
            />
        </PageSurface>
    );
}

/**
 * Metadata dinâmica baseada no perfil. Quando o perfil está oculto
 * ou não existe, devolvemos um título genérico para evitar leak de
 * conteúdo via OG tags.
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
        };
    }

    const { perfil } = result;
    const localizacao = `${perfil.cidadeNome}, ${perfil.estadoSigla}`;
    const description = perfil.descricao
        ? perfil.descricao.slice(0, 160)
        : `Perfil de ${perfil.nome} em ${localizacao}.`;

    return {
        title: `${perfil.nome} (@${perfil.identificador})`,
        description,
        openGraph: {
            title: `${perfil.nome} · ${localizacao}`,
            description,
            images: perfil.fotoUrl ? [{ url: perfil.fotoUrl }] : undefined,
            type: "profile",
        },
    };
}
