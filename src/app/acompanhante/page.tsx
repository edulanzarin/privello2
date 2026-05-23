import {
    HeartIcon,
    LogoutButton,
    MetricPill,
    MicIcon,
    PageSurface,
    ProfileCoverEditor,
    ProfilePhotoEditor,
    SparklesIcon,
    TabList,
    TabPanel,
    TabTrigger,
    Tabs,
    UsersIcon,
} from "@/components";
import { getCurrentSession } from "@/server/auth/currentSession";
import { obterPerfilAcompanhante } from "@/server/acompanhante-profile";
import { obterStatusBoost } from "@/server/boost";
import { obterVigente } from "@/server/planos";
import { listarGaleria, toMediaItem } from "@/server/storage/galleryMedia";

import { PerfilTab } from "./_painel/PerfilTab";
import { MidiasTab } from "./_painel/MidiasTab";
import { AudioTab } from "./_painel/AudioTab";
import { ConfiguracoesTab } from "./_painel/ConfiguracoesTab";
import { PerfilOcultoBanner } from "./_painel/PerfilOcultoBanner";
import type { MediaItem } from "@/components";

/**
 * Painel privado da Acompanhante (`/acompanhante`).
 *
 * Página inicial da área autenticada. O acesso é controlado pelo
 * {@link import("./layout").default} (sessão válida +
 * `userType = ACOMPANHANTE` + plano vigente — Requirements 1.6, 1.7,
 * 5.5, 5.10), portanto aqui podemos pressupor que `getCurrentSession`
 * devolve uma sessão de Acompanhante e que `obterVigente` retorna um
 * `PlanoDefinition` não-nulo.
 *
 * # Estrutura visual
 *
 * 1. {@link ProfileHeader} — avatar grande, nome, identificador, badge
 *    do plano vigente.
 * 2. Linha compacta de {@link MetricPill}s — três indicadores de
 *    saúde da conta (visualizações totais, curtidas totais, mídias
 *    publicadas vs. limite do plano).
 *    Substitui o trio anterior de StatTiles gigantes que comia metade
 *    da viewport. Hoje "visualizações" e "curtidas" exibem `"—"`
 *    porque o `Sistema_de_Estatisticas` (e o `Sistema_de_Likes`
 *    agregando) ainda não existem; quando existirem, os
 *    valores são preenchidos sem mudar a estrutura.
 * 3. {@link Tabs} com URL hash — Perfil, Mídias, Áudio (quando
 *    Premium), Configurações. O conteúdo de cada aba vive em
 *    `src/app/acompanhante/_painel/`.
 */

export default async function AcompanhantePainelPage() {
    const session = await getCurrentSession();
    // Layout garante presença de sessão; assert estrutural defensivo:
    if (!session) {
        // Fallback inalcançável em produção. Lançar um erro em vez de
        // redirecionar mantém o tipo `PerfilAcompanhanteResumo`
        // não-nulo abaixo sem complicar a UI com guarda extra.
        throw new Error("Painel acessado sem sessão resolvida.");
    }

    const [perfil, planoVigente] = await Promise.all([
        obterPerfilAcompanhante(session.userId),
        obterVigente(session.userId),
    ]);

    if (!perfil || !planoVigente) {
        throw new Error(
            "Painel acessado sem perfil ou plano vigente; checagem do layout falhou.",
        );
    }

    const galeria = await listarGaleria(session.userId);
    const galeriaItems: ReadonlyArray<MediaItem> = galeria.map(toMediaItem);
    const boost = await obterStatusBoost(session.userId);

    const isPremium = planoVigente.tipo === "PREMIUM";

    return (
        <PageSurface
            banner={<ProfileCoverEditor coverUrl={perfil.coverUrl} />}
        >
            <ProfilePhotoEditor
                photoUrl={perfil.fotoUrl}
                name={perfil.nome}
                identifier={`@${perfil.identificador}`}
                avatarCornerBadge={
                    isPremium ? <HeartIcon size={11} /> : null
                }
                actions={<LogoutButton variant="button" />}
            />

            {/* Banner persistente quando o perfil está oculto. Visível
                em todas as abas (vem antes do <Tabs>) para que a
                Acompanhante não precise descobrir a aba Configurações
                pra publicar. Some assim que `perfilVisivel` vira true. */}
            <PerfilOcultoBanner perfilVisivel={perfil.perfilVisivel} />

            {/* Linha de métricas — 3 pills sempre na mesma linha
                (grid 3 colunas). Visualizações = total acumulado de
                aberturas do perfil; curtidas = soma das curtidas em
                todas as mídias e Stories; mídias = uso atual versus
                limite do plano. */}
            <div
                role="group"
                aria-label="Resumo do perfil"
                className="grid grid-cols-3 gap-2"
            >
                <MetricPill
                    icon={<UsersIcon size={11} />}
                    value="—"
                    label="visualizações"
                />
                <MetricPill
                    icon={<HeartIcon size={11} />}
                    value="—"
                    label="curtidas"
                />
                <MetricPill
                    icon={<SparklesIcon size={11} />}
                    value={`${galeriaItems.length}/${planoVigente.limiteMidias}`}
                    label="mídias"
                />
            </div>

            <Tabs defaultValue="perfil" urlHash className="flex flex-col gap-5">
                <TabList aria-label="Áreas do painel">
                    <TabTrigger value="perfil">Perfil</TabTrigger>
                    <TabTrigger value="midias">Mídias</TabTrigger>
                    {planoVigente.permiteAudio ? (
                        <TabTrigger value="audio">
                            <MicIcon size={14} />
                            Áudio
                        </TabTrigger>
                    ) : null}
                    <TabTrigger value="configuracoes">Configurações</TabTrigger>
                </TabList>

                <TabPanel value="perfil">
                    <PerfilTab perfil={perfil} />
                </TabPanel>
                <TabPanel value="midias">
                    <MidiasTab plano={planoVigente} items={galeriaItems} />
                </TabPanel>
                {planoVigente.permiteAudio ? (
                    <TabPanel value="audio">
                        <AudioTab
                            audioUrl={perfil.audioUrl}
                            audioMimeType={perfil.audioMimeType}
                        />
                    </TabPanel>
                ) : null}
                <TabPanel value="configuracoes">
                    <ConfiguracoesTab
                        email={perfil.email}
                        planoTipo={planoVigente.tipo}
                        perfilVisivel={perfil.perfilVisivel}
                        boostUntil={boost.boostUntil}
                    />
                </TabPanel>
            </Tabs>
        </PageSurface>
    );
}