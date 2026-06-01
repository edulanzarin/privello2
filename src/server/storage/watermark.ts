/**
 * Aplicação de marca d'água em mídias da galeria.
 *
 * Compõe sobre a foto **ou vídeo** dois elementos:
 *   1. Um selo central translúcido da marca (ícone flame de
 *      `public/logo.png` + texto "Privello").
 *   2. O link vanity da Acompanhante (`privello.com.br/<handle>`) no
 *      canto inferior direito, em pílula escura translúcida — leva
 *      direto pro perfil quando digitado/clicado.
 *
 * Foto_de_Perfil e Capa_de_Perfil **não** recebem marca d'água — só
 * mídias da galeria pública.
 *
 * Stack:
 *   - **Fotos**: `sharp` (pipeline raster).
 *   - **Vídeos**: `ffmpeg-static` (binário pré-built injeta os
 *     overlays via filtro `overlay`). Re-encoda no mesmo
 *     container/codec padrão (H.264/AAC). Áudio passa direto com
 *     `-c:a copy`.
 *
 * Em qualquer falha, devolvemos o buffer original e logamos o erro.
 * Marca d'água é "best-effort enhancement".
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";

import type { GaleriaTipo } from "@/domain/validation";
import { db } from "@/lib/db";
import { logger } from "@/lib/observability/logger";

const log = logger("watermark");

/**
 * Resolve o caminho do binário FFmpeg. Em ESM o `ffmpeg-static` às
 * vezes vira `{ default: <string> }` por causa do interop com CJS;
 * normalizamos aqui para um string ou `null`.
 */
const ffmpegPath: string | null = (() => {
    const value = ffmpegStatic as unknown;
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "default" in value) {
        const inner = (value as { default: unknown }).default;
        return typeof inner === "string" ? inner : null;
    }
    return null;
})();

const PUBLIC_DIR = path.join(process.cwd(), "public");
// Ícone da marca (flame) — mesma imagem do `<Logo>` / top bar.
const LOGO_PATH = path.join(PUBLIC_DIR, "logo.png");

/**
 * Largura do selo central da marca como fração da largura da mídia.
 * Selo "marca" no centro — presença forte mas translúcida.
 */
const OVERLAY_RATIO = 0.42;

/** Margem do link de canto em relação às bordas, fração da largura. */
const MARGIN_RATIO = 0.025;

/** Largura do link vanity (canto) como fração da largura da mídia. */
const LINK_RATIO = 0.36;

/**
 * Domínio exibido no link vanity da marca d'água. Deriva da
 * `NEXT_PUBLIC_SITE_URL` (sem protocolo/porta) e cai em
 * `privello.com.br` quando ausente/local — o link estampado deve ser
 * sempre o domínio público, não `localhost`.
 */
const VANITY_HOST: string = (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    try {
        const host = new URL(raw).host;
        if (host.length > 0 && !host.includes("localhost")) {
            return host;
        }
    } catch {
        // ignora URL inválida/ausente
    }
    return "privello.com.br";
})();

/**
 * Verifica que o asset da marca existe no disco. É checado uma vez
 * no boot do módulo e o resultado é cacheado; se faltar,
 * `applyGalleryWatermark` pula a aplicação silenciosamente e loga
 * apenas no primeiro uso.
 */
let assetsAvailable: boolean | null = null;
function ensureAssets(): boolean {
    if (assetsAvailable !== null) return assetsAvailable;
    assetsAvailable = fs.existsSync(LOGO_PATH);
    if (!assetsAvailable) {
        log.warn(
            "logo.png ausente em /public — marca d'água será pulada",
            { path: LOGO_PATH },
        );
    }
    return assetsAvailable;
}

/**
 * Constrói o selo central da marca (ícone flame + "Privello") como
 * PNG RGBA com largura `badgeWidth`. O ícone vem de `public/logo.png`;
 * o texto e a sombra são desenhados via SVG. Layout horizontal: logo
 * à esquerda, texto à direita, alinhados verticalmente.
 *
 * `opacity` (0..1) controla a translucidez geral — o selo central
 * fica semi-transparente pra não cobrir a mídia.
 *
 * Retorna `{ png, width, height }` pra o caller posicionar.
 */
async function construirSelo(
    badgeWidth: number,
    opacity: number = 1,
): Promise<{
    png: Buffer;
    width: number;
    height: number;
}> {
    // Proporções internas do selo, derivadas da largura.
    const logoSize = Math.round(badgeWidth * 0.2);
    const gap = Math.round(badgeWidth * 0.05);
    const fontSize = Math.round(badgeWidth * 0.17);
    const height = Math.max(logoSize, Math.round(fontSize * 1.3));
    const textX = logoSize + gap;
    // Baseline pra centralizar o texto verticalmente no selo.
    const textBaseline = Math.round(height / 2 + fontSize * 0.36);
    const logoTop = Math.round((height - logoSize) / 2);

    const logo = await sharp(LOGO_PATH)
        .resize(logoSize, logoSize, { fit: "contain" })
        .png()
        .toBuffer();

    // SVG com o texto "Privello" branco + leve sombra pra legibilidade
    // sobre qualquer fundo. O ícone é composto por cima depois.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeWidth}" height="${height}" viewBox="0 0 ${badgeWidth} ${height}">
        <defs>
            <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.55)"/>
            </filter>
        </defs>
        <text x="${textX}" y="${textBaseline}" font-family="sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" filter="url(#ds)">Privello</text>
    </svg>`;

    let pipeline = sharp(Buffer.from(svg)).composite([
        { input: logo, top: logoTop, left: 0 },
    ]);

    // Aplica translucidez multiplicando o canal alpha do selo todo.
    if (opacity < 1) {
        const flat = await pipeline.png().toBuffer();
        pipeline = sharp(flat).ensureAlpha().composite([
            {
                input: Buffer.from([
                    255,
                    255,
                    255,
                    Math.round(opacity * 255),
                ]),
                raw: { width: 1, height: 1, channels: 4 },
                tile: true,
                blend: "dest-in",
            },
        ]);
    }

    const png = await pipeline.png().toBuffer();
    return { png, width: badgeWidth, height };
}

/**
 * Constrói o selo de canto com o **link vanity** da Acompanhante
 * (`privello.com.br/<identificador>`), em pílula translúcida escura
 * pra legibilidade. Largura alvo `linkWidth` — a altura é derivada do
 * tamanho de fonte. O texto é centralizado na pílula.
 */
async function construirLinkSelo(
    identificador: string,
    linkWidth: number,
): Promise<{ png: Buffer; width: number; height: number }> {
    const texto = `${VANITY_HOST}/${identificador}`;
    const safe = escaparXml(texto);

    // Fonte proporcional à largura alvo, limitada por nº de chars pra
    // não estourar. ~0.55em por char em sans-serif bold.
    const fontByWidth = linkWidth / (texto.length * 0.55);
    const fontSize = Math.max(14, Math.round(fontByWidth));
    const padX = Math.round(fontSize * 0.7);
    const padY = Math.round(fontSize * 0.45);
    const textWidth = Math.round(texto.length * fontSize * 0.55);
    const width = textWidth + padX * 2;
    const height = Math.round(fontSize + padY * 2);
    const radius = Math.round(height / 2);
    const baseline = Math.round(height / 2 + fontSize * 0.35);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="rgba(20,10,8,0.5)"/>
        <text x="${width / 2}" y="${baseline}" font-family="sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff" text-anchor="middle">${safe}</text>
    </svg>`;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return { png, width, height };
}

/**
 * Escapa caracteres especiais pra interpolar texto seguro num SVG.
 */
function escaparXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Resolve o `identificador` (handle público) do dono da mídia. Usado
 * pra estampar o link vanity. Retorna `null` em falha — nesse caso o
 * link de canto é omitido (o selo central continua).
 */
async function resolverIdentificador(
    ownerId: string,
): Promise<string | null> {
    try {
        const user = await db.user.findUnique({
            where: { id: ownerId },
            select: { identificador: true },
        });
        return user?.identificador ?? null;
    } catch {
        return null;
    }
}

/**
 * Aplica marca d'água em uma mídia da galeria. Retorna o buffer
 * resultante (mesmo MIME que a entrada).
 *
 * Compõe **dois** elementos sobre a mídia:
 *   1. Selo central translúcido da marca (logo + "Privello").
 *   2. Link vanity da Acompanhante (`privello.com.br/<handle>`) no
 *      canto inferior direito — só quando `ownerId` resolve um
 *      identificador.
 *
 * Em falha de processamento, devolve o `bytes` original e loga o
 * erro (sem `throw` — upload não pode falhar por causa de
 * watermark).
 */
export async function applyGalleryWatermark(args: {
    bytes: Buffer | Uint8Array;
    mimeType: string;
    tipo: GaleriaTipo;
    /** Dono da mídia — usado pra estampar o link vanity. */
    ownerId?: string;
}): Promise<Buffer> {
    const buffer = Buffer.isBuffer(args.bytes)
        ? args.bytes
        : Buffer.from(args.bytes);

    if (!ensureAssets()) {
        return buffer;
    }

    const identificador = args.ownerId
        ? await resolverIdentificador(args.ownerId)
        : null;

    if (args.tipo === "VIDEO") {
        if (!ffmpegPath) {
            log.warn(
                "ffmpeg-static não resolveu binário — vídeo será passado direto",
            );
            return buffer;
        }
        try {
            return await watermarkVideo(buffer, args.mimeType, identificador);
        } catch (err) {
            log.error("falha ao aplicar marca d'água em vídeo", err, {
                mimeType: args.mimeType,
            });
            return buffer;
        }
    }

    try {
        return await watermarkPhoto(buffer, args.mimeType, identificador);
    } catch (err) {
        log.error("falha ao aplicar marca d'água em foto", err, {
            mimeType: args.mimeType,
        });
        return buffer;
    }
}

/**
 * Compõe a marca d'água em uma foto:
 *
 *  1. Mede a imagem.
 *  2. Gera o selo central translúcido (logo + "Privello") e compõe
 *     no centro.
 *  3. Quando há `identificador`, gera o link vanity e compõe no canto
 *     inferior direito, respeitando a margem.
 *  4. Reserializa no MIME original.
 */
async function watermarkPhoto(
    buffer: Buffer,
    mimeType: string,
    identificador: string | null,
): Promise<Buffer> {
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width <= 0 || height <= 0) {
        return buffer;
    }
    if (width < 240 || height < 240) {
        // Imagem minúscula — marca d'água ficaria ilegível.
        return buffer;
    }

    const overlays: sharp.OverlayOptions[] = [];

    // 1. Selo central translúcido.
    const badgeWidth = Math.round(width * OVERLAY_RATIO);
    const selo = await construirSelo(badgeWidth, 0.6);
    overlays.push({
        input: selo.png,
        top: Math.round((height - selo.height) / 2),
        left: Math.round((width - selo.width) / 2),
    });

    // 2. Link vanity no canto inferior direito.
    if (identificador) {
        const linkWidth = Math.round(width * LINK_RATIO);
        const link = await construirLinkSelo(identificador, linkWidth);
        const margin = Math.round(width * MARGIN_RATIO);
        overlays.push({
            input: link.png,
            top: Math.max(0, height - link.height - margin),
            left: Math.max(0, width - link.width - margin),
        });
    }

    const composited = sharp(buffer).rotate().composite(overlays);

    if (mimeType === "image/png") {
        return composited.png({ compressionLevel: 9 }).toBuffer();
    }
    if (mimeType === "image/webp") {
        return composited.webp({ quality: 86 }).toBuffer();
    }
    return composited.jpeg({ quality: 88, progressive: true }).toBuffer();
}


/**
 * Mapeia o MIME do vídeo para a extensão usada no arquivo temporário
 * que alimenta o FFmpeg. Os MIMEs aqui já passaram pela validação
 * canônica (`validarGaleriaMidia`), mas mantemos o `default` como
 * `mp4` para qualquer container futuro que escape sem mudar a
 * função.
 */
function videoExt(mimeType: string): string {
    if (mimeType === "video/webm") return "webm";
    if (mimeType === "video/quicktime") return "mov";
    return "mp4";
}

/**
 * Lê width/height do vídeo via FFmpeg (`-f null -`). Mais leve que
 * `ffprobe` e usa o mesmo binário. Parseamos a primeira linha do
 * stderr que casa com `Stream #x:y: Video: ... NxM`.
 */
function probeVideoSize(filePath: string): Promise<{ width: number; height: number }> {
    if (!ffmpegPath) {
        return Promise.reject(new Error("ffmpeg-static não disponível"));
    }
    const bin = ffmpegPath;
    return new Promise((resolve, reject) => {
        const proc = spawn(bin, ["-i", filePath], {
            stdio: ["ignore", "ignore", "pipe"],
        });
        let stderr = "";
        let settled = false;
        const finish = (fn: () => void): void => {
            if (settled) return;
            settled = true;
            fn();
        };

        // Timeout curto: o probe só lê metadata, nada deve demorar
        // mais que 10s mesmo em arquivos pesados. Se demorar mais,
        // provavelmente é arquivo corrompido — aborta.
        const timeout = setTimeout(() => {
            proc.kill("SIGKILL");
            finish(() =>
                reject(new Error("ffmpeg probe timeout (>10s)")),
            );
        }, 10_000);

        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        proc.on("error", (err) =>
            finish(() => {
                clearTimeout(timeout);
                reject(err);
            }),
        );
        proc.on("close", () =>
            finish(() => {
                clearTimeout(timeout);
                // FFmpeg sempre imprime no stderr a linha
                //   Stream #0:0(...): Video: ... (...), yuv420p(...), WIDTHxHEIGHT, ...
                // O detalhe entre `Video:` e a resolução varia por
                // codec/container — pegamos a primeira ocorrência
                // de `WxH` plausível depois da palavra `Video:`.
                const match = stderr.match(
                    /Video:[\s\S]*?\b(\d{2,5})x(\d{2,5})\b/,
                );
                if (!match) {
                    reject(
                        new Error(
                            `não foi possível ler dimensões: ${stderr.slice(-400)}`,
                        ),
                    );
                    return;
                }
                resolve({
                    width: Number.parseInt(match[1]!, 10),
                    height: Number.parseInt(match[2]!, 10),
                });
            }),
        );
    });
}

function runFfmpeg(args: ReadonlyArray<string>): Promise<void> {
    if (!ffmpegPath) {
        return Promise.reject(new Error("ffmpeg-static não disponível"));
    }
    const bin = ffmpegPath;
    return new Promise((resolve, reject) => {
        const proc = spawn(bin, args, {
            stdio: ["ignore", "ignore", "pipe"],
        });
        let stderr = "";
        let settled = false;
        const finish = (fn: () => void): void => {
            if (settled) return;
            settled = true;
            fn();
        };

        // Timeout duro: vídeos malformados podem fazer o ffmpeg
        // travar indefinidamente em produção. 90s é generoso para
        // re-encode H.264 de até 1 minuto a CRF 23. Se passar disso,
        // aborta e devolve erro — o caller cai no buffer original.
        const timeout = setTimeout(() => {
            proc.kill("SIGKILL");
            finish(() =>
                reject(new Error("ffmpeg timeout (>90s) — vídeo abortado")),
            );
        }, 90_000);

        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        proc.on("error", (err) =>
            finish(() => {
                clearTimeout(timeout);
                reject(err);
            }),
        );
        proc.on("close", (code) =>
            finish(() => {
                clearTimeout(timeout);
                if (code === 0) {
                    resolve();
                } else {
                    reject(
                        new Error(
                            `ffmpeg exit ${code}: ${stderr.slice(-400)}`,
                        ),
                    );
                }
            }),
        );
    });
}

/**
 * Aplica a marca d'água em um vídeo usando FFmpeg.
 *
 * Estratégia:
 *
 *  1. Grava o blob recebido em um arquivo temporário (FFmpeg lê de
 *     stdin com mais facilidade só em containers específicos; arquivo
 *     evita compatibilidade duvidosa com WebM/MOV em pipe).
 *  2. Gera os PNGs de overlay (selo central translúcido + link vanity
 *     de canto) e os passa como inputs extras.
 *  3. Chama o `ffmpeg` com filter complex que compõe:
 *     - o selo central no meio (`(W-w)/2:(H-h)/2`);
 *     - o link vanity no canto inferior direito (com margem), quando
 *       há `identificador`.
 *     - re-encoda vídeo com H.264 / preset `veryfast` / CRF 23.
 *       `-movflags +faststart` deixa o MP4 streamável. Áudio passa
 *       direto (`-c:a copy`). `-y` sobrescreve o output.
 *  4. Lê o arquivo final, deleta os temporários, devolve o buffer.
 *
 * Em qualquer erro, o caller (`applyGalleryWatermark`) cai no buffer
 * original.
 */
async function watermarkVideo(
    buffer: Buffer,
    mimeType: string,
    identificador: string | null,
): Promise<Buffer> {
    const tmpDir = await fsp.mkdtemp(
        path.join(os.tmpdir(), "privello-wm-"),
    );
    const ext = videoExt(mimeType);
    const inputPath = path.join(tmpDir, `in-${randomUUID()}.${ext}`);
    const outputPath = path.join(tmpDir, `out-${randomUUID()}.${ext}`);
    const seloPath = path.join(tmpDir, `wm-${randomUUID()}.png`);
    const linkPath = path.join(tmpDir, `lk-${randomUUID()}.png`);

    try {
        await fsp.writeFile(inputPath, buffer);

        // Lê dimensões do vídeo pra calcular largura exata dos
        // overlays em pixels — bem mais confiável que filtros tipo
        // `scale2ref` (que mudam comportamento entre versões do
        // FFmpeg).
        const { width: videoWidth } = await probeVideoSize(inputPath);
        const seloWidth = Math.max(
            64,
            Math.round(videoWidth * OVERLAY_RATIO),
        );
        const margin = Math.max(8, Math.round(videoWidth * MARGIN_RATIO));

        // Selo central translúcido (input 1).
        const selo = await construirSelo(seloWidth, 0.6);
        await fsp.writeFile(seloPath, selo.png);

        // Inputs do ffmpeg + filtro. Começa com o selo central.
        const inputs = ["-i", inputPath, "-i", seloPath];
        // [0:v][1:v] selo no centro → [tmp]
        let filter =
            "[0:v][1:v]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2";

        // Link vanity de canto (input 2), só quando há identificador.
        if (identificador) {
            const linkWidth = Math.round(videoWidth * LINK_RATIO);
            const link = await construirLinkSelo(identificador, linkWidth);
            await fsp.writeFile(linkPath, link.png);
            inputs.push("-i", linkPath);
            // encadeia: resultado anterior [t] + [2:v] no canto.
            filter +=
                `[t];[t][2:v]overlay=main_w-overlay_w-${margin}:main_h-overlay_h-${margin}[v]`;
        } else {
            filter += "[v]";
        }

        await runFfmpeg([
            "-y",
            ...inputs,
            "-filter_complex", filter,
            "-map", "[v]",
            "-map", "0:a?", // copia áudio se houver
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-c:a", "copy",
            outputPath,
        ]);

        const result = await fsp.readFile(outputPath);
        return result;
    } finally {
        // Best-effort cleanup. Falha aqui não importa porque o tmp
        // do SO é limpo periodicamente.
        await fsp.rm(tmpDir, { recursive: true, force: true }).catch(
            () => undefined,
        );
    }
}
