/**
 * Sistema de busca/listagem pública de Acompanhantes
 * (`/acompanhantes`).
 *
 * Filtros aceitos (todos opcionais):
 *   - `q`: texto livre (busca em `nome` e `descricao`).
 *   - `estadoSigla`, `cidadeNome`: localização exata.
 *   - `genero`, `etnia`, `corOlhos`, `estiloCabelo`, `tamanhoCabelo`.
 *   - `idiomas`: lista — qualquer um (`hasSome`).
 *   - `formasPagamento`: lista — qualquer uma (`hasSome`).
 *   - `diasAtende`: lista — qualquer um (`hasSome`).
 *   - `atendePublicos`: lista — qualquer um (`hasSome`).
 *   - `praticas`: lista — qualquer uma (`hasSome`).
 *   - `precoMin`/`precoMax`: faixa em centavos.
 *   - `comAudio`: apenas perfis com áudio publicado.
 *   - `comBoost`: apenas perfis com boost ativo.
 *   - `verificada`: apenas perfis com identidade verificada (selo).
 *
 * Ordenação:
 *   - `relevancia` (default): boost ativo → premium → demais, depois
 *     `viewsCount` desc, depois `updatedAt` desc.
 *   - `recentes`: `updatedAt` desc.
 *   - `preco_asc`: `valorHoraCents` asc (nulls last).
 *   - `preco_desc`: `valorHoraCents` desc (nulls last).
 *   - `popular`: `viewsCount` desc, `updatedAt` desc.
 *
 * Paginação: offset + limit. Devolve `total` para a UI montar o
 * paginator. Limit clampado em [1, 60].
 *
 * Sempre filtra `perfilVisivel = true` e `planoVigente IS NOT NULL`
 * (mesmo filtro de visibilidade do perfil público).
 */

import type { Prisma } from "@prisma/client";

import {
    isCorOlhos,
    isEstiloCabelo,
    isEtnia,
    isIdioma,
    isTamanhoCabelo,
} from "@/domain/aparencia/definitions";
import { isAtende, isPratica } from "@/domain/atendimento";
import {
    isDiaSemana,
    isFormaPagamento,
} from "@/domain/atendimentoComercial";
import { isBoostAtivo } from "@/domain/boost/definitions";
import { isGenero } from "@/domain/genero";
import { db } from "@/lib/db";

import type { PlanoExibicao } from "./index";
import type { FeedItem } from "./feed";

export type BuscaOrdenacao =
    | "relevancia"
    | "recentes"
    | "preco_asc"
    | "preco_desc"
    | "popular";

export interface BuscaFiltros {
    q?: string;
    estadoSigla?: string;
    cidadeNome?: string;
    /**
     * Filtra por bairro exato (case-insensitive). Alimentado pelo
     * mapa de bairros — clicar num bairro filtra a lista por ele.
     */
    bairroNome?: string;
    genero?: string;
    etnia?: string;
    corOlhos?: string;
    estiloCabelo?: string;
    tamanhoCabelo?: string;
    idiomas?: ReadonlyArray<string>;
    formasPagamento?: ReadonlyArray<string>;
    diasAtende?: ReadonlyArray<string>;
    atendePublicos?: ReadonlyArray<string>;
    praticas?: ReadonlyArray<string>;
    precoMin?: number;
    precoMax?: number;
    comAudio?: boolean;
    comBoost?: boolean;
    /**
     * Apenas perfis com identidade verificada (`verificada = true`).
     * Premia quem fez a verificação e dá ao Cliente um filtro de
     * confiança ao buscar.
     */
    verificada?: boolean;
}

export interface BuscaInput {
    filtros: BuscaFiltros;
    ordenar?: BuscaOrdenacao;
    page?: number;
    perPage?: number;
    now?: Date;
}

export interface BuscaResultado {
    items: ReadonlyArray<FeedItem>;
    total: number;
    page: number;
    perPage: number;
    pages: number;
}

const DEFAULT_PER_PAGE = 24;
const MAX_PER_PAGE = 60;

const include = {
    user: { select: { nome: true, identificador: true } },
    fotoPerfil: { select: { storageKey: true } },
    audioApresentacao: {
        select: { storageKey: true, mimeType: true, status: true },
    },
} satisfies Prisma.AcompanhanteProfileInclude;

type Row = Prisma.AcompanhanteProfileGetPayload<{ include: typeof include }>;

/**
 * Constrói o `where` do Prisma a partir dos filtros de entrada.
 *
 * Filtros enum/categóricos são validados pelos type guards canônicos
 * (`isGenero`, `isEtnia`, etc.) — se vier algo inválido, o filtro é
 * silenciosamente ignorado em vez de quebrar a query. Texto livre
 * usa `contains` case-insensitive em `nome` e `descricao`.
 */
function buildWhere(
    filtros: BuscaFiltros,
    now: Date,
): Prisma.AcompanhanteProfileWhereInput {
    const where: Prisma.AcompanhanteProfileWhereInput = {
        perfilVisivel: true,
        planoVigente: { not: null },
        user: { type: "ACOMPANHANTE" },
    };

    const q = filtros.q?.trim();
    if (q && q.length > 0) {
        where.OR = [
            {
                user: {
                    type: "ACOMPANHANTE",
                    nome: { contains: q, mode: "insensitive" },
                },
            },
            { descricao: { contains: q, mode: "insensitive" } },
        ];
    }

    if (filtros.estadoSigla && filtros.estadoSigla.length === 2) {
        where.estadoSigla = filtros.estadoSigla.toUpperCase();
    }
    if (filtros.cidadeNome && filtros.cidadeNome.trim().length > 0) {
        where.cidadeNome = filtros.cidadeNome.trim();
    }
    if (filtros.bairroNome && filtros.bairroNome.trim().length > 0) {
        where.bairroNome = {
            equals: filtros.bairroNome.trim(),
            mode: "insensitive",
        };
    }

    if (filtros.genero && isGenero(filtros.genero)) {
        where.genero = filtros.genero;
    }
    if (filtros.etnia && isEtnia(filtros.etnia)) {
        where.etnia = filtros.etnia;
    }
    if (filtros.corOlhos && isCorOlhos(filtros.corOlhos)) {
        where.corOlhos = filtros.corOlhos;
    }
    if (filtros.estiloCabelo && isEstiloCabelo(filtros.estiloCabelo)) {
        where.estiloCabelo = filtros.estiloCabelo;
    }
    if (filtros.tamanhoCabelo && isTamanhoCabelo(filtros.tamanhoCabelo)) {
        where.tamanhoCabelo = filtros.tamanhoCabelo;
    }

    if (filtros.idiomas) {
        const valid = filtros.idiomas.filter(isIdioma);
        if (valid.length > 0) {
            where.idiomas = { hasSome: valid };
        }
    }
    if (filtros.formasPagamento) {
        const valid = filtros.formasPagamento.filter(isFormaPagamento);
        if (valid.length > 0) {
            where.formasPagamento = { hasSome: valid };
        }
    }
    if (filtros.diasAtende) {
        const valid = filtros.diasAtende.filter(isDiaSemana);
        if (valid.length > 0) {
            where.diasAtende = { hasSome: valid };
        }
    }
    if (filtros.atendePublicos) {
        const valid = filtros.atendePublicos.filter(isAtende);
        if (valid.length > 0) {
            where.atendePublicos = { hasSome: valid };
        }
    }
    if (filtros.praticas) {
        const valid = filtros.praticas.filter(isPratica);
        if (valid.length > 0) {
            where.realizaPraticas = { hasSome: valid };
        }
    }

    if (
        typeof filtros.precoMin === "number" &&
        Number.isFinite(filtros.precoMin) &&
        filtros.precoMin >= 0
    ) {
        where.valorHoraCents = {
            ...(where.valorHoraCents as Prisma.IntNullableFilter | undefined),
            gte: Math.floor(filtros.precoMin),
        };
    }
    if (
        typeof filtros.precoMax === "number" &&
        Number.isFinite(filtros.precoMax) &&
        filtros.precoMax > 0
    ) {
        where.valorHoraCents = {
            ...(where.valorHoraCents as Prisma.IntNullableFilter | undefined),
            lte: Math.floor(filtros.precoMax),
        };
    }

    if (filtros.comAudio === true) {
        where.audioApresentacaoId = { not: null };
    }
    if (filtros.comBoost === true) {
        where.boostUntil = { gt: now };
    }
    if (filtros.verificada === true) {
        where.verificada = true;
    }

    return where;
}

/**
 * Constrói o `orderBy` baseado em ordenação. Para `relevancia`
 * usamos uma combinação de `boostUntil`, depois `planoVigente`
 * (Premium antes de Básico via ordenação determinística), depois
 * `viewsCount` e `updatedAt`.
 */
function buildOrderBy(
    ordenar: BuscaOrdenacao,
): Prisma.AcompanhanteProfileOrderByWithRelationInput[] {
    switch (ordenar) {
        case "recentes":
            return [{ updatedAt: "desc" }];
        case "preco_asc":
            return [
                { valorHoraCents: { sort: "asc", nulls: "last" } },
                { updatedAt: "desc" },
            ];
        case "preco_desc":
            return [
                { valorHoraCents: { sort: "desc", nulls: "last" } },
                { updatedAt: "desc" },
            ];
        case "popular":
            return [
                { viewsCount: "desc" },
                { updatedAt: "desc" },
            ];
        case "relevancia":
        default:
            return [
                { boostUntil: { sort: "desc", nulls: "last" } },
                { planoVigente: { sort: "desc", nulls: "last" } },
                { viewsCount: "desc" },
                { updatedAt: "desc" },
            ];
    }
}

/**
 * Executa a busca paginada. Retorna itens no mesmo shape do feed
 * da home (`FeedItem`) pra que a UI possa reusar `ProfileFeedCard`
 * sem mudança.
 */
export async function buscar(input: BuscaInput): Promise<BuscaResultado> {
    const now = input.now ?? new Date();
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const perPage = Math.max(
        1,
        Math.min(MAX_PER_PAGE, Math.floor(input.perPage ?? DEFAULT_PER_PAGE)),
    );
    const skip = (page - 1) * perPage;

    const where = buildWhere(input.filtros, now);
    const orderBy = buildOrderBy(input.ordenar ?? "relevancia");

    const [rows, total] = await Promise.all([
        db.acompanhanteProfile.findMany({
            where,
            orderBy,
            include,
            skip,
            take: perPage,
        }),
        db.acompanhanteProfile.count({ where }),
    ]);

    // Conta mídias da galeria em uma query agregada (evita N+1).
    const ownerIds = rows.map((r) => r.userId);
    const mediasCountMap = await contarMidiasGaleria(ownerIds);

    const items = rows.map((row) => toFeedItem(row, now, mediasCountMap));

    return {
        items,
        total,
        page,
        perPage,
        pages: Math.max(1, Math.ceil(total / perPage)),
    };
}

async function contarMidiasGaleria(
    ownerIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
    if (ownerIds.length === 0) return new Map();
    const grupos = await db.media.groupBy({
        by: ["ownerId"],
        where: {
            ownerId: { in: ownerIds as string[] },
            role: "GALLERY",
            status: "COMMITTED",
        },
        _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const g of grupos) {
        map.set(g.ownerId, g._count._all);
    }
    return map;
}

function toFeedItem(
    row: Row,
    now: Date,
    mediasMap: Map<string, number>,
): FeedItem {
    const planoExibicao: PlanoExibicao = isBoostAtivo(row.boostUntil, now)
        ? "BOOST"
        : row.planoVigente === "PREMIUM"
            ? "PREMIUM"
            : "BASICO";

    const audioOk =
        row.audioApresentacao !== null &&
            row.audioApresentacao.status === "COMMITTED"
            ? row.audioApresentacao
            : null;

    return {
        identificador: row.user.identificador,
        nome: row.user.nome,
        fotoUrl: row.fotoPerfil
            ? `/api/storage/${row.fotoPerfil.storageKey}`
            : null,
        estadoSigla: row.estadoSigla,
        cidadeNome: row.cidadeNome,
        bairroNome: row.bairroNome,
        descricao: row.descricao,
        planoExibicao,
        verificada: row.verificada,
        viewsCount: row.viewsCount,
        reviewsCount: row.reviewsCount,
        valorHoraCents: row.valorHoraCents,
        audioUrl: audioOk ? `/api/storage/${audioOk.storageKey}` : null,
        audioMimeType: audioOk ? audioOk.mimeType : null,
        mediasCount: mediasMap.get(row.userId) ?? 0,
    };
}

/**
 * Lista UFs únicas de Acompanhantes visíveis. Útil para popular o
 * filtro de UF na busca sem depender da API do IBGE.
 */
export async function listarUfsDisponiveis(): Promise<ReadonlyArray<string>> {
    const rows = await db.acompanhanteProfile.findMany({
        where: {
            perfilVisivel: true,
            planoVigente: { not: null },
            user: { type: "ACOMPANHANTE" },
        },
        distinct: ["estadoSigla"],
        select: { estadoSigla: true },
        orderBy: { estadoSigla: "asc" },
    });
    return rows.map((r) => r.estadoSigla);
}

// ---------------------------------------------------------------------------
// Mapa interativo (T14) — agregação por bairro
// ---------------------------------------------------------------------------

/**
 * Agregado de um bairro (ou cidade, quando o perfil não informa
 * bairro) pro mapa da busca. Um marcador por região, com a
 * contagem de perfis. NÃO carrega identidade de perfil — o mapa é
 * só uma vitrine de "quantas atendem em cada bairro".
 */
export interface MapaBairro {
    /** Rótulo da região (nome do bairro, ou da cidade no fallback). */
    label: string;
    /** Centroide da região (mesmo ponto pra todos do bairro). */
    lat: number;
    lng: number;
    /** Quantos perfis nesta região (após os filtros). */
    count: number;
    /** `true` quando é o centro da cidade (perfis sem bairro). */
    cidadeFallback: boolean;
}

/**
 * Agrega perfis geocodificados por bairro pra o mapa. Aplica os
 * mesmos filtros do {@link buscar} (via {@link buildWhere}) + a
 * exigência de `lat`/`lng` não-nulos.
 *
 * Agrupa por `(lat, lng)` arredondado — como a geocodificação usa o
 * **centroide do bairro** (sem jitter, ver `geocode.ts`), todos os
 * perfis de um mesmo bairro caem no mesmo ponto e somam num único
 * marcador. Perfis sem bairro caem no centro da cidade e somam ali.
 *
 * O rótulo de cada agregado vem do `bairroNome` (ou da `cidadeNome`
 * quando todos do grupo são fallback de cidade). Não devolve
 * nenhuma info de perfil individual — privacidade by design.
 */
export async function listarBairrosParaMapa(input: {
    filtros: BuscaFiltros;
    limit?: number;
    now?: Date;
}): Promise<ReadonlyArray<MapaBairro>> {
    const now = input.now ?? new Date();
    const limit = Math.max(1, Math.min(2000, input.limit ?? 1000));

    const where = buildWhere(input.filtros, now);
    where.lat = { not: null };
    where.lng = { not: null };

    const rows = await db.acompanhanteProfile.findMany({
        where,
        take: limit,
        select: {
            lat: true,
            lng: true,
            bairroNome: true,
            cidadeNome: true,
        },
    });

    // Agrupa por coordenada arredondada (5 casas ≈ 1m de resolução,
    // suficiente pra colapsar centroides idênticos do mesmo bairro
    // mesmo com ruído de ponto flutuante).
    interface Acc {
        lat: number;
        lng: number;
        count: number;
        bairros: Map<string, number>;
        cidade: string;
        semBairro: number;
    }
    const grupos = new Map<string, Acc>();

    for (const row of rows) {
        if (row.lat === null || row.lng === null) continue;
        const key = `${row.lat.toFixed(5)}:${row.lng.toFixed(5)}`;
        let acc = grupos.get(key);
        if (!acc) {
            acc = {
                lat: row.lat,
                lng: row.lng,
                count: 0,
                bairros: new Map(),
                cidade: row.cidadeNome,
                semBairro: 0,
            };
            grupos.set(key, acc);
        }
        acc.count += 1;
        const bairro = row.bairroNome?.trim();
        if (bairro && bairro.length > 0) {
            acc.bairros.set(bairro, (acc.bairros.get(bairro) ?? 0) + 1);
        } else {
            acc.semBairro += 1;
        }
    }

    const out: MapaBairro[] = [];
    for (const acc of grupos.values()) {
        // Rótulo: bairro dominante do grupo; se ninguém tem bairro,
        // é o centro da cidade.
        let label = acc.cidade;
        let cidadeFallback = true;
        if (acc.bairros.size > 0) {
            let topBairro = "";
            let topCount = -1;
            for (const [nome, c] of acc.bairros) {
                if (c > topCount) {
                    topCount = c;
                    topBairro = nome;
                }
            }
            label = topBairro;
            cidadeFallback = false;
        }
        out.push({
            label,
            lat: acc.lat,
            lng: acc.lng,
            count: acc.count,
            cidadeFallback,
        });
    }
    // Maiores primeiro (só por estabilidade de render).
    out.sort((a, b) => b.count - a.count);
    return out;
}

