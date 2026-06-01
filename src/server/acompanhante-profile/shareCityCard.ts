/**
 * Card-imagem de compartilhamento por cidade (V6).
 *
 * Estende a ideia do {@link import("./shareCard").gerarShareCard}
 * (T11), mas pro nível da busca: gera um PNG 1080×1920 que anuncia
 * "N acompanhantes em [Cidade], [UF]" — pronto pra postar no
 * Instagram Story / WhatsApp Status e levar tráfego pra busca.
 *
 * # Pipeline (sharp, sem libs extras)
 *
 *  1. Conta perfis visíveis com plano vigente na cidade (mesma
 *     regra de visibilidade da busca).
 *  2. Monta um fundo: colagem com até 4 fotos de perfil da cidade
 *     (quando houver) ou um gradiente warm sólido de fallback.
 *  3. Compõe um SVG por cima: shade + número grande, "acompanhantes
 *     em Cidade, UF" + wordmark (logo da marca + "Privello").
 *  4. Exporta PNG.
 *
 * Resultado discriminado — o caller (route handler) mapeia status
 * HTTP e cuida do cache (ETag).
 */

import sharp from "sharp";

import { db } from "@/lib/db";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

import { escaparXml } from "./shareCard";
import {
    camadasComWordmark,
    carregarLogoMarca,
    wordmarkTextSvg,
} from "./shareWordmark";

export type ShareCityCardResult =
    | { ok: true; png: Buffer; etagSeed: string }
    | {
        ok: false;
        reason: "CIDADE_INVALIDA" | "SEM_RESULTADOS" | "PERSISTENCIA";
    };

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

// ---------------------------------------------------------------------------
// Singleton R2 + test seam
// ---------------------------------------------------------------------------

let r2ClientSingleton: R2Client | null = null;

function getR2Client(): R2Client {
    if (!r2ClientSingleton) {
        r2ClientSingleton = createR2Client();
    }
    return r2ClientSingleton;
}

/** Test seam — injeta um R2 client fake. */
export function __setR2ClientForShareCityTests(
    client: R2Client | null,
): void {
    r2ClientSingleton = client;
}

// ---------------------------------------------------------------------------
// Pluralização
// ---------------------------------------------------------------------------

/**
 * Frase do card conforme a contagem. Mantém português correto pro
 * singular ("1 acompanhante").
 */
function fraseContagem(total: number): string {
    return total === 1 ? "acompanhante em" : "acompanhantes em";
}

// ---------------------------------------------------------------------------
// Overlay SVG
// ---------------------------------------------------------------------------

function construirOverlaySvg(data: {
    total: number;
    cidadeNome: string;
    estadoSigla: string;
}): Buffer {
    const numero = data.total.toLocaleString("pt-BR");
    const frase = escaparXml(fraseContagem(data.total));
    const local = escaparXml(`${data.cidadeNome}, ${data.estadoSigla}`);
    // Trunca a cidade pra não estourar a largura do card.
    const localCurto =
        local.length > 26 ? `${local.slice(0, 25)}…` : local;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
        <defs>
            <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(20,10,8,0.55)"/>
                <stop offset="45%" stop-color="rgba(20,10,8,0.25)"/>
                <stop offset="100%" stop-color="rgba(20,10,8,0.88)"/>
            </linearGradient>
            <linearGradient id="topglow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(236,123,91,0.4)"/>
                <stop offset="100%" stop-color="rgba(236,123,91,0)"/>
            </linearGradient>
        </defs>
        <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#shade)"/>
        <rect x="0" y="0" width="${CARD_WIDTH}" height="360" fill="url(#topglow)"/>
        <text x="64" y="1380" font-family="sans-serif" font-size="280" font-weight="800" fill="#ffffff">${numero}</text>
        <text x="64" y="1480" font-family="sans-serif" font-size="56" font-weight="500" fill="rgba(255,255,255,0.85)">${frase}</text>
        <text x="64" y="1576" font-family="sans-serif" font-size="84" font-weight="800" fill="#ffffff">📍 ${localCurto}</text>
        ${wordmarkTextSvg()}
    </svg>`;

    return Buffer.from(svg);
}

/**
 * Fundo de fallback (sem fotos): gradiente warm sólido em PNG.
 */
async function fundoFallback(): Promise<Buffer> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ec7b5b"/>
                <stop offset="100%" stop-color="#c5523a"/>
            </linearGradient>
        </defs>
        <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
    </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Monta o fundo do card. Com 1+ fotos, faz uma colagem em grade
 * (1, 2 ou 4 células) cobrindo a tela. Sem fotos, cai no gradiente.
 *
 * Best-effort: qualquer falha ao ler/processar uma foto cai pro
 * fallback — o card sempre é gerado.
 */
async function construirFundo(
    storageKeys: ReadonlyArray<string>,
): Promise<Buffer> {
    if (storageKeys.length === 0) {
        return fundoFallback();
    }

    try {
        const r2 = getR2Client();
        const buffers: Buffer[] = [];
        for (const key of storageKeys.slice(0, 4)) {
            const bytes = await r2.fetch(key);
            if (bytes) buffers.push(Buffer.from(bytes));
        }
        if (buffers.length === 0) {
            return fundoFallback();
        }

        // 1 foto → cover total. 2+ → grade 2×2 (preenchendo o que
        // faltar repetindo as disponíveis pra não deixar buraco).
        if (buffers.length === 1) {
            return sharp(buffers[0])
                .rotate()
                .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover" })
                .toBuffer();
        }

        const cellW = Math.floor(CARD_WIDTH / 2);
        const cellH = Math.floor(CARD_HEIGHT / 2);
        const posicoes = [
            { left: 0, top: 0 },
            { left: cellW, top: 0 },
            { left: 0, top: cellH },
            { left: cellW, top: cellH },
        ];

        const celulas = await Promise.all(
            posicoes.map(async (pos, i) => {
                const src = buffers[i % buffers.length];
                const cell = await sharp(src)
                    .rotate()
                    .resize(cellW, cellH, { fit: "cover" })
                    .toBuffer();
                return { input: cell, left: pos.left, top: pos.top };
            }),
        );

        const base = await fundoFallback();
        return sharp(base).composite(celulas).png().toBuffer();
    } catch {
        return fundoFallback();
    }
}

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

/**
 * Gera o card-imagem PNG da cidade. Conta perfis visíveis com plano
 * vigente em `(cidadeNome, estadoSigla)` e monta o card.
 *
 * - `CIDADE_INVALIDA`: parâmetros ausentes/curtos demais.
 * - `SEM_RESULTADOS`: nenhum perfil visível na cidade (não faz
 *   sentido divulgar "0 acompanhantes").
 * - `PERSISTENCIA`: falha de I/O.
 */
export async function gerarShareCityCard(input: {
    cidadeNome: string;
    estadoSigla: string;
}): Promise<ShareCityCardResult> {
    const cidadeNome = input.cidadeNome.trim();
    const estadoSigla = input.estadoSigla.trim().toUpperCase();

    if (cidadeNome.length === 0 || estadoSigla.length !== 2) {
        return { ok: false, reason: "CIDADE_INVALIDA" };
    }

    const where = {
        perfilVisivel: true,
        planoVigente: { not: null },
        user: { type: "ACOMPANHANTE" as const },
        cidadeNome: { equals: cidadeNome, mode: "insensitive" as const },
        estadoSigla,
    };

    let total: number;
    let fotos: Array<{ fotoPerfil: { storageKey: string } | null }>;
    try {
        [total, fotos] = await Promise.all([
            db.acompanhanteProfile.count({ where }),
            db.acompanhanteProfile.findMany({
                where: { ...where, fotoPerfil: { isNot: null } },
                orderBy: { boostUntil: { sort: "desc", nulls: "last" } },
                take: 4,
                select: { fotoPerfil: { select: { storageKey: true } } },
            }),
        ]);
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (total === 0) {
        return { ok: false, reason: "SEM_RESULTADOS" };
    }

    const storageKeys = fotos
        .map((f) => f.fotoPerfil?.storageKey)
        .filter((k): k is string => typeof k === "string");

    const base = await construirFundo(storageKeys);
    const overlay = construirOverlaySvg({ total, cidadeNome, estadoSigla });
    const logoMarca = await carregarLogoMarca();

    let png: Buffer;
    try {
        png = await sharp(base)
            .composite(camadasComWordmark(overlay, logoMarca))
            .flatten({ background: "#140a08" })
            .png({ compressionLevel: 9, palette: true, quality: 90 })
            .toBuffer();
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // Seed do ETag: cidade + contagem + as fotos usadas. Muda quando
    // entra/sai perfil ou troca a foto de capa da colagem. `v2:`
    // bumpado quando o layout mudou (rodapé com logo da marca).
    const etagSeed = `v2:${cidadeNome.toLowerCase()}:${estadoSigla}:${total}:${storageKeys.join(",")}`;

    return { ok: true, png, etagSeed };
}
