/**
 * Card-imagem de compartilhamento (T11).
 *
 * Gera um PNG no formato 9:16 (1080×1920, ideal pra Instagram Story
 * / WhatsApp Status) com a foto de perfil em cover, um gradiente
 * escuro no rodapé pra legibilidade, e overlay de texto com nome,
 * @handle, cidade/UF e selos (verificada / plano).
 *
 * # Pipeline (sharp, sem libs extras)
 *
 *  1. Resolve o perfil pelo slug (precisa estar visível + com plano).
 *  2. Lê os bytes da foto de perfil do R2 (`R2Client.fetch`).
 *  3. Redimensiona a foto pra cobrir 1080×1920 (`fit: cover`).
 *  4. Compõe por cima um SVG: gradiente inferior + textos + selos +
 *     wordmark "privello".
 *  5. Exporta PNG.
 *
 * Quando o perfil não tem foto, usa um fundo gradiente warm sólido
 * (o card ainda funciona, só sem o retrato).
 *
 * Resultado discriminado — o caller (route handler) mapeia em
 * status HTTP e cuida do cache (ETag).
 */

import sharp from "sharp";

import { db } from "@/lib/db";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

import {
    camadasComWordmark,
    carregarLogoMarca,
    wordmarkTextSvg,
} from "./shareWordmark";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type ShareCardResult =
    | { ok: true; png: Buffer; etagSeed: string }
    | { ok: false; reason: "NAO_ENCONTRADO" | "OCULTO" | "PERSISTENCIA" };

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
export function __setR2ClientForShareCardTests(client: R2Client | null): void {
    r2ClientSingleton = client;
}

// ---------------------------------------------------------------------------
// Escape de XML/SVG
// ---------------------------------------------------------------------------

/**
 * Escapa caracteres especiais pra interpolar texto seguro num SVG.
 * Evita quebra de markup (e injeção) quando nome/cidade tiverem
 * `&`, `<`, `>`, aspas. Exportada pra teste unitário direto.
 */
export function escaparXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Trunca um texto pra caber no card sem estourar a largura. Limite
 * em caracteres (aproximação — fonte não é monoespaçada, mas serve
 * pra evitar overflow grosseiro). Adiciona reticências.
 */
function truncar(value: string, max: number): string {
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Construção do SVG de overlay
// ---------------------------------------------------------------------------

interface CardData {
    nome: string;
    identificador: string;
    cidadeNome: string;
    estadoSigla: string;
    verificada: boolean;
    planoLabel: string | null;
}

/**
 * Monta o SVG do overlay (gradiente + textos + selos). Dimensões
 * casam com o canvas (1080×1920). Usa `sans-serif` genérica —
 * librsvg/fontconfig resolve no servidor (validado em runtime).
 */
function construirOverlaySvg(data: CardData): Buffer {
    const nome = escaparXml(truncar(data.nome, 22));
    const handle = escaparXml(`@${truncar(data.identificador, 24)}`);
    const local = escaparXml(
        truncar(`${data.cidadeNome}, ${data.estadoSigla}`, 30),
    );

    // Selos: pílulas empilhadas acima do nome. Verificada primeiro.
    const pills: string[] = [];
    let pillX = 64;
    const pillY = 1400;
    if (data.verificada) {
        const label = "✓ Verificada";
        const w = 80 + label.length * 20;
        pills.push(
            `<g>
                <rect x="${pillX}" y="${pillY}" rx="36" ry="36" width="${w}" height="72" fill="#10b981"/>
                <text x="${pillX + w / 2}" y="${pillY + 48}" font-family="sans-serif" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle">${escaparXml(label)}</text>
            </g>`,
        );
        pillX += w + 20;
    }
    if (data.planoLabel) {
        const label = data.planoLabel;
        const w = 60 + label.length * 22;
        pills.push(
            `<g>
                <rect x="${pillX}" y="${pillY}" rx="36" ry="36" width="${w}" height="72" fill="rgba(255,255,255,0.92)"/>
                <text x="${pillX + w / 2}" y="${pillY + 48}" font-family="sans-serif" font-size="34" font-weight="700" fill="#c5523a" text-anchor="middle">${escaparXml(label)}</text>
            </g>`,
        );
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
        <defs>
            <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
                <stop offset="55%" stop-color="rgba(20,10,8,0.15)"/>
                <stop offset="100%" stop-color="rgba(20,10,8,0.85)"/>
            </linearGradient>
            <linearGradient id="topglow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(236,123,91,0.35)"/>
                <stop offset="100%" stop-color="rgba(236,123,91,0)"/>
            </linearGradient>
        </defs>
        <rect x="0" y="0" width="${CARD_WIDTH}" height="320" fill="url(#topglow)"/>
        <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#shade)"/>
        ${pills.join("\n")}
        <text x="64" y="1560" font-family="sans-serif" font-size="92" font-weight="800" fill="#ffffff">${nome}</text>
        <text x="64" y="1640" font-family="sans-serif" font-size="44" font-weight="500" fill="rgba(255,255,255,0.82)">${handle}</text>
        <text x="64" y="1716" font-family="sans-serif" font-size="44" font-weight="500" fill="rgba(255,255,255,0.82)">📍 ${local}</text>
        ${wordmarkTextSvg()}
    </svg>`;

    return Buffer.from(svg);
}

/**
 * Fundo de fallback (sem foto): gradiente warm sólido em PNG.
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

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

/**
 * Gera o card-imagem PNG do perfil identificado por `slug`.
 *
 * Só gera pra perfis visíveis com plano vigente (mesma regra do
 * perfil público). `etagSeed` combina identificador + updatedAt +
 * verificada pra que o ETag mude quando algo relevante muda.
 */
export async function gerarShareCard(slug: string): Promise<ShareCardResult> {
    const slugNorm = slug.trim().toLowerCase();
    if (slugNorm.length === 0) {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }

    let profile;
    try {
        profile = await db.acompanhanteProfile.findFirst({
            where: { user: { identificador: slugNorm, type: "ACOMPANHANTE" } },
            select: {
                perfilVisivel: true,
                planoVigente: true,
                cidadeNome: true,
                estadoSigla: true,
                verificada: true,
                boostUntil: true,
                updatedAt: true,
                user: { select: { nome: true, identificador: true } },
                fotoPerfil: { select: { storageKey: true } },
            },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (!profile) {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }
    if (!profile.perfilVisivel || profile.planoVigente === null) {
        return { ok: false, reason: "OCULTO" };
    }

    const planoLabel = profile.planoVigente === "PREMIUM" ? "Premium" : null;

    const overlay = construirOverlaySvg({
        nome: profile.user.nome,
        identificador: profile.user.identificador,
        cidadeNome: profile.cidadeNome,
        estadoSigla: profile.estadoSigla,
        verificada: profile.verificada,
        planoLabel,
    });

    // Base: foto em cover, ou fundo fallback quando sem foto.
    let base: Buffer;
    try {
        if (profile.fotoPerfil) {
            const bytes = await getR2Client().fetch(
                profile.fotoPerfil.storageKey,
            );
            if (bytes) {
                base = await sharp(Buffer.from(bytes))
                    .rotate()
                    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover" })
                    .toBuffer();
            } else {
                base = await fundoFallback();
            }
        } else {
            base = await fundoFallback();
        }
    } catch {
        // Falha ao ler/processar a foto → usa fallback (não derruba).
        base = await fundoFallback();
    }

    // Logo da marca (flame) pro wordmark do rodapé. Best-effort.
    const logoMarca = await carregarLogoMarca();

    let png: Buffer;
    try {
        png = await sharp(base)
            .composite(camadasComWordmark(overlay, logoMarca))
            // Achata sobre fundo escuro (o card é sempre opaco) pra
            // remover o canal alpha — reduz bem o tamanho. `palette`
            // quantiza as cores: PNG fica ~10x menor sem perda
            // perceptível pro uso (Story/Status).
            .flatten({ background: "#140a08" })
            .png({ compressionLevel: 9, palette: true, quality: 90 })
            .toBuffer();
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // `v2` na seed: bumpado quando o layout do card muda (rodapé com
    // logo da marca). Garante que clientes com ETag antigo regerem.
    const etagSeed = `v2:${profile.user.identificador}:${profile.updatedAt.getTime()}:${
        profile.verificada ? "v" : "n"
    }:${profile.planoVigente}`;

    return { ok: true, png, etagSeed };
}
