/**
 * Buscas salvas + alerta in-site (V3).
 *
 * O Cliente salva uma busca (cidade + filtros). Quando um perfil
 * novo passa a aparecer nas buscas (a Acompanhante publica/atualiza)
 * e casa com os filtros salvos, o Cliente recebe uma **notificação
 * in-site** (reusa V2). Nunca por email.
 *
 * # Como a correspondência funciona
 *
 * Quando uma Acompanhante liga a visibilidade do perfil, chamamos
 * {@link casarBuscasSalvas} com o `userId` dela. Pra cada busca
 * salva, reaproveitamos a engine real de busca ({@link buscar})
 * filtrando pelo `userId` do perfil recém-publicado — se ele
 * aparece no resultado, a busca casa e o Cliente é notificado.
 *
 * Isso garante semântica idêntica à busca de verdade (sem duplicar
 * a lógica de `where`). `lastNotifiedAt` evita notificar o mesmo
 * Cliente repetidamente pela mesma onda de publicações.
 */

import { db } from "@/lib/db";
import { buscar, type BuscaFiltros } from "@/server/acompanhante-profile/buscar";
import { criarNotificacao } from "@/server/notifications";
import { normalizarFiltros } from "./normalizar";

export { normalizarFiltros } from "./normalizar";

/** Limite de buscas salvas por Cliente — evita abuso/poluição. */
const MAX_BUSCAS_POR_CLIENTE = 20;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Busca salva, no shape consumido pela UI do painel do Cliente.
 */
export interface SavedSearchItem {
    id: string;
    label: string;
    filtros: BuscaFiltros;
    criadoEm: Date;
}

export type SalvarBuscaResult =
    | { ok: true; id: string }
    | { ok: false; reason: "CIDADE_OBRIGATORIA" | "LIMITE" | "PERSISTENCIA" };

// ---------------------------------------------------------------------------
// Salvar
// ---------------------------------------------------------------------------

/**
 * Salva uma busca pro Cliente. Exige cidade (a busca por cidade é
 * o eixo do produto). Gera um `label` amigável a partir da cidade +
 * filtros ativos. Limita a {@link MAX_BUSCAS_POR_CLIENTE}.
 */
export async function salvarBusca(input: {
    clientUserId: string;
    filtros: BuscaFiltros;
}): Promise<SalvarBuscaResult> {
    const filtros = normalizarFiltros(input.filtros);

    // Cidade é obrigatória — sem ela o alerta seria amplo demais.
    if (!filtros.cidadeNome || filtros.cidadeNome.trim().length === 0) {
        return { ok: false, reason: "CIDADE_OBRIGATORIA" };
    }

    const total = await db.savedSearch.count({
        where: { clientUserId: input.clientUserId },
    });
    if (total >= MAX_BUSCAS_POR_CLIENTE) {
        return { ok: false, reason: "LIMITE" };
    }

    const label = montarLabel(filtros);

    try {
        const row = await db.savedSearch.create({
            data: {
                clientUserId: input.clientUserId,
                label,
                filtros: filtros as unknown as object,
            },
            select: { id: true },
        });
        return { ok: true, id: row.id };
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

/**
 * Monta um rótulo legível pra busca salva. Ex.:
 * "Curitiba, PR · Verificadas · com áudio".
 */
function montarLabel(filtros: BuscaFiltros): string {
    const partes: string[] = [];
    if (filtros.cidadeNome) {
        partes.push(
            filtros.estadoSigla
                ? `${filtros.cidadeNome}, ${filtros.estadoSigla}`
                : filtros.cidadeNome,
        );
    }
    if (filtros.bairroNome) partes.push(filtros.bairroNome);
    if (filtros.genero && filtros.genero !== "MULHER") {
        partes.push(filtros.genero.toLowerCase());
    }
    if (filtros.verificada) partes.push("verificadas");
    if (filtros.comAudio) partes.push("com áudio");
    if (filtros.comBoost) partes.push("em destaque");
    if (typeof filtros.precoMax === "number") {
        partes.push(`até ${Math.floor(filtros.precoMax / 100)} reais`);
    }
    const label = partes.join(" · ");
    return label.length > 160 ? label.slice(0, 157) + "…" : label;
}

// ---------------------------------------------------------------------------
// Listar / excluir
// ---------------------------------------------------------------------------

/**
 * Lista as buscas salvas do Cliente, mais recentes primeiro.
 */
export async function listarBuscas(
    clientUserId: string,
): Promise<ReadonlyArray<SavedSearchItem>> {
    const rows = await db.savedSearch.findMany({
        where: { clientUserId },
        orderBy: { criadoEm: "desc" },
        take: MAX_BUSCAS_POR_CLIENTE,
        select: { id: true, label: true, filtros: true, criadoEm: true },
    });
    return rows.map((r) => ({
        id: r.id,
        label: r.label,
        filtros: normalizarFiltros(r.filtros as BuscaFiltros),
        criadoEm: r.criadoEm,
    }));
}

/**
 * Exclui uma busca salva. Escopado ao próprio `clientUserId`.
 */
export async function excluirBusca(input: {
    clientUserId: string;
    id: string;
}): Promise<{ ok: true }> {
    await db.savedSearch.deleteMany({
        where: { id: input.id, clientUserId: input.clientUserId },
    });
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Matcher — dispara quando um perfil novo aparece
// ---------------------------------------------------------------------------

/**
 * Casa um perfil recém-publicado contra todas as buscas salvas e
 * notifica os Clientes cujos filtros batem (V3). Best-effort:
 * varre em lote, engole falhas isoladas e nunca lança.
 *
 * Reaproveita {@link buscar} com `cidadeNome` do perfil + o filtro
 * salvo, restrito ao `acompanhanteUserId`, garantindo semântica
 * idêntica à busca real. Notifica no máximo uma vez por busca por
 * onda (`lastNotifiedAt`).
 *
 * @param acompanhanteUserId Perfil que acabou de ficar visível.
 */
export async function casarBuscasSalvas(
    acompanhanteUserId: string,
    options: { now?: Date } = {},
): Promise<{ notificados: number }> {
    const now = options.now ?? new Date();

    // Dados do perfil pra (a) restringir a cidade e (b) compor a
    // notificação.
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId: acompanhanteUserId },
        select: {
            cidadeNome: true,
            perfilVisivel: true,
            planoVigente: true,
            user: { select: { nome: true, identificador: true } },
        },
    });
    // Só casa perfis efetivamente visíveis nas buscas.
    if (
        !profile ||
        !profile.perfilVisivel ||
        profile.planoVigente === null
    ) {
        return { notificados: 0 };
    }

    // Só buscas salvas da mesma cidade podem casar — reduz o
    // espaço de varredura drasticamente (cidade é filtro central).
    const candidatas = await db.savedSearch.findMany({
        where: {
            filtros: {
                path: ["cidadeNome"],
                equals: profile.cidadeNome,
            },
        },
        select: {
            id: true,
            clientUserId: true,
            label: true,
            filtros: true,
            lastNotifiedAt: true,
        },
    });

    let notificados = 0;
    for (const busca of candidatas) {
        try {
            const filtros = normalizarFiltros(busca.filtros as BuscaFiltros);
            const resultado = await buscar({
                filtros,
                page: 1,
                perPage: 60,
                now,
            });
            const casou = resultado.items.some(
                (item) => item.identificador === profile.user.identificador,
            );
            if (!casou) continue;

            // Não auto-notifica: se o Cliente é a própria Acompanhante
            // (não deveria, mas defensivo).
            if (busca.clientUserId === acompanhanteUserId) continue;

            await criarNotificacao({
                userId: busca.clientUserId,
                type: "BUSCA_NOVA_CORRESPONDENCIA",
                payload: {
                    buscaLabel: busca.label,
                    perfilNome: profile.user.nome,
                    perfilIdentificador: profile.user.identificador,
                },
            });
            await db.savedSearch.update({
                where: { id: busca.id },
                data: { lastNotifiedAt: now },
            });
            notificados += 1;
        } catch {
            // falha isolada não interrompe as demais.
        }
    }

    return { notificados };
}
