import {
    ChatIcon,
    DiamondIcon,
    HeartIcon,
    LogoutButton,
    MetricPill,
    PageSurface,
    PlayCircleIcon,
    ProfilePhotoEditor,
    TabList,
    TabPanel,
    TabTrigger,
    Tabs,
} from "@/components";
import { getCurrentSession } from "@/server/auth/currentSession";
import { obterPerfilCliente } from "@/server/cliente-profile";
import {
    contarInteracoesDoCliente,
    listarComentariosDoCliente,
    listarLikesDoCliente,
} from "@/server/media-interactions";
import {
    contarReviewsDoCliente,
    listarReviewsDoCliente,
} from "@/server/reviews";

import { AtividadeTab } from "./_painel/AtividadeTab";
import { ConfiguracoesTab } from "./_painel/ConfiguracoesTab";
import { PerfilTab } from "./_painel/PerfilTab";

/**
 * Painel privado do Cliente (`/cliente`).
 *
 * Página inicial da área autenticada do Cliente. O acesso é controlado
 * pelo {@link import("./layout").default} (sessão válida +
 * `userType = CLIENTE` — Requirements 1.6, 1.7).
 *
 * # Estrutura
 *
 * 1. {@link ProfileHeader} — avatar, nome, identificador, badge do
 *    plano vigente.
 * 2. Linha de {@link MetricPill}s compactos com curtidas, comentários
 *    e avaliações (substitui o trio de StatTiles gigantes que
 *    consumia metade da viewport).
 * 3. {@link Tabs} com URL hash — Perfil, Atividade, Configurações. O
 *    conteúdo de cada tab vive em `_painel/`.
 *
 * # Diferença para o painel da Acompanhante
 *
 * O painel do Cliente é mais "leitor": foco em ver atividade e ajustar
 * conta, não em publicar. As seções refletem essa diferença — em vez
 * de "Mídias" e "Áudio", temos "Atividade" (consumo) e
 * "Configurações" (manutenção).
 *
 * # Visibilidade ao histórico
 *
 * Quando uma Acompanhante desativa o perfil ou cancela o plano, todas
 * as interações do Cliente com ela (curtidas, comentários, avaliações)
 * deixam de aparecer no histórico. Essa regra é aplicada via filtro no
 * read em cada query de `_painel/AtividadeTab` (Caminho A: filtrar no
 * read em vez de soft-delete em massa). Como ainda não existem as
 * tabelas `media_likes`/`media_comments`/`reviews`, o filtro será
 * adicionado junto com a feature de cada tipo de interação.
 */

export default async function ClientePainelPage() {
    const session = await getCurrentSession();
    if (!session) {
        // Inalcançável em produção (layout protege) — defesa estática
        // para o type-checker.
        throw new Error("Painel acessado sem sessão resolvida.");
    }

    const perfil = await obterPerfilCliente(session.userId);
    if (!perfil) {
        throw new Error(
            "Painel acessado sem perfil resolvido; checagem do layout falhou.",
        );
    }

    const [reviews, reviewsCount, likes, comentarios, interacoes] =
        await Promise.all([
            listarReviewsDoCliente(session.userId),
            contarReviewsDoCliente(session.userId),
            listarLikesDoCliente(session.userId),
            listarComentariosDoCliente(session.userId),
            contarInteracoesDoCliente(session.userId),
        ]);

    const isFan = perfil.planoVigente === "FAN";

    return (
        <PageSurface>
            <ProfilePhotoEditor
                photoUrl={perfil.fotoUrl}
                name={perfil.nome}
                identifier={`@${perfil.identificador}`}
                avatarCornerBadge={
                    isFan ? <DiamondIcon size={11} /> : null
                }
                actions={<LogoutButton variant="button" />}
            />

            {/* Linha de métricas compacta — sempre 3 pills na mesma
                linha (grid 3 colunas). Em telas muito estreitas o
                label trunca, mas o ícone preserva o sentido. */}
            <div
                role="group"
                aria-label="Resumo da atividade"
                className="grid grid-cols-3 gap-2"
            >
                <MetricPill
                    icon={<HeartIcon size={11} />}
                    value={interacoes.likes > 0 ? String(interacoes.likes) : "—"}
                    label="curtidas"
                />
                <MetricPill
                    icon={<PlayCircleIcon size={11} />}
                    value={
                        interacoes.comentarios > 0
                            ? String(interacoes.comentarios)
                            : "—"
                    }
                    label="comentários"
                />
                <MetricPill
                    icon={<ChatIcon size={11} />}
                    value={reviewsCount > 0 ? String(reviewsCount) : "—"}
                    label="avaliações"
                />
            </div>

            <Tabs defaultValue="perfil" urlHash className="flex flex-col gap-5">
                <TabList aria-label="Áreas do painel">
                    <TabTrigger value="perfil">Perfil</TabTrigger>
                    <TabTrigger value="atividade">Atividade</TabTrigger>
                    <TabTrigger value="configuracoes">
                        Configurações
                    </TabTrigger>
                </TabList>

                <TabPanel value="perfil">
                    <PerfilTab perfil={perfil} />
                </TabPanel>
                <TabPanel value="atividade">
                    <AtividadeTab
                        planoVigente={perfil.planoVigente}
                        reviews={reviews}
                        likes={likes}
                        comentarios={comentarios}
                    />
                </TabPanel>
                <TabPanel value="configuracoes">
                    <ConfiguracoesTab perfil={perfil} />
                </TabPanel>
            </Tabs>
        </PageSurface>
    );
}
