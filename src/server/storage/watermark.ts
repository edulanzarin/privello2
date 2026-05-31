/**
 * Aplicação de marca d'água em mídias da galeria.
 *
 * Compõe sobre a foto **ou vídeo** a palavra "Privello" vazada
 * (`public/privello.png`) centralizada, ocupando ~30% da largura
 * da mídia. Asset PNG cuida da opacidade e do contorno — basta
 * editar `public/privello.png` para ajustar o visual.
 *
 * Foto_de_Perfil e Capa_de_Perfil **não** recebem marca d'água — só
 * mídias da galeria pública.
 *
 * Stack:
 *   - **Fotos**: `sharp` (pipeline raster).
 *   - **Vídeos**: `ffmpeg-static` (binário pré-built injeta o overlay
 *     via filtro `overlay`). Re-encoda no mesmo container/codec
 *     padrão (H.264/AAC) — esse passo é necessário porque overlay
 *     exige re-render do stream de vídeo. Áudio passa direto
 *     com `-c:a copy`.
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
const PRIVELLO_TEXT_PATH = path.join(PUBLIC_DIR, "privello.png");

/**
 * Largura do overlay como fração da largura da mídia. Mantida
 * consistente entre fotos e vídeos para identidade visual única.
 */
const OVERLAY_RATIO = 0.3;

/**
 * Verifica que o asset de marca d'água existe no disco. É checado
 * uma vez no boot do módulo e o resultado é cacheado; se faltar,
 * `applyGalleryWatermark` pula a aplicação silenciosamente e loga
 * apenas no primeiro uso.
 */
let assetsAvailable: boolean | null = null;
function ensureAssets(): boolean {
    if (assetsAvailable !== null) return assetsAvailable;
    assetsAvailable = fs.existsSync(PRIVELLO_TEXT_PATH);
    if (!assetsAvailable) {
        log.warn(
            "privello.png ausente em /public — marca d'água será pulada",
            { path: PRIVELLO_TEXT_PATH },
        );
    }
    return assetsAvailable;
}

/**
 * Aplica marca d'água em uma mídia da galeria. Retorna o buffer
 * resultante (mesmo MIME que a entrada).
 *
 * Para `tipo === "FOTO"`, compõe overlay via sharp.
 * Para `tipo === "VIDEO"`, retorna o buffer original.
 *
 * Em falha de processamento, devolve o `bytes` original e loga o
 * erro (sem `throw` — upload não pode falhar por causa de
 * watermark).
 */
export async function applyGalleryWatermark(args: {
    bytes: Buffer | Uint8Array;
    mimeType: string;
    tipo: GaleriaTipo;
}): Promise<Buffer> {
    const buffer = Buffer.isBuffer(args.bytes)
        ? args.bytes
        : Buffer.from(args.bytes);

    if (args.tipo === "VIDEO") {
        if (!ensureAssets()) {
            return buffer;
        }
        if (!ffmpegPath) {
            log.warn(
                "ffmpeg-static não resolveu binário — vídeo será passado direto",
            );
            return buffer;
        }
        try {
            return await watermarkVideo(buffer, args.mimeType);
        } catch (err) {
            log.error("falha ao aplicar marca d'água em vídeo", err, {
                mimeType: args.mimeType,
            });
            return buffer;
        }
    }

    if (!ensureAssets()) {
        return buffer;
    }

    try {
        return await watermarkPhoto(buffer, args.mimeType);
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
 *  2. Define a largura do overlay = 80% da largura da imagem.
 *  3. Redimensiona o `privello.png` proporcionalmente.
 *  4. Centra na imagem e composit.
 *  5. Reserializa no MIME original.
 */
async function watermarkPhoto(
    buffer: Buffer,
    mimeType: string,
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

    // Largura do overlay = `OVERLAY_RATIO` da largura da imagem.
    const overlayWidth = Math.round(width * OVERLAY_RATIO);

    const overlay = await sharp(PRIVELLO_TEXT_PATH)
        .resize({ width: overlayWidth })
        .png()
        .toBuffer();
    const overlayMeta = await sharp(overlay).metadata();
    const overlayHeight = overlayMeta.height ?? 0;

    const left = Math.round((width - overlayWidth) / 2);
    const top = Math.round((height - overlayHeight) / 2);

    const composited = sharp(buffer)
        .rotate()
        .composite([{ input: overlay, top, left }]);

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
 *  2. Chama o `ffmpeg` com:
 *     - `-i input` (vídeo) e `-i privello.png` (overlay).
 *     - filter complex que escala o PNG para `OVERLAY_RATIO` da
 *       largura do vídeo e centraliza com `(W-w)/2:(H-h)/2`.
 *     - re-encoda vídeo com H.264 / preset `veryfast` / CRF 23
 *       (qualidade boa, tamanho razoável). `-movflags +faststart`
 *       deixa o MP4 streamável.
 *     - Áudio passa direto (`-c:a copy`) pra não re-encodar.
 *     - `-y` sobrescreve o output sem perguntar.
 *  3. Lê o arquivo final, deleta os temporários, devolve o buffer.
 *
 * Em qualquer erro, o caller (`applyGalleryWatermark`) cai no buffer
 * original.
 */
async function watermarkVideo(
    buffer: Buffer,
    mimeType: string,
): Promise<Buffer> {
    const tmpDir = await fsp.mkdtemp(
        path.join(os.tmpdir(), "privello-wm-"),
    );
    const ext = videoExt(mimeType);
    const inputPath = path.join(tmpDir, `in-${randomUUID()}.${ext}`);
    const outputPath = path.join(tmpDir, `out-${randomUUID()}.${ext}`);

    try {
        await fsp.writeFile(inputPath, buffer);

        // Lê dimensões do vídeo pra calcular largura exata do
        // overlay em pixels — bem mais confiável que filtros tipo
        // `scale2ref` (que mudam comportamento entre versões do
        // FFmpeg).
        const { width: videoWidth } = await probeVideoSize(inputPath);
        const overlayWidth = Math.max(
            64,
            Math.round(videoWidth * OVERLAY_RATIO),
        );

        // Filter complex:
        //   [1:v] escala o PNG para `overlayWidth`px de largura,
        //         altura proporcional (-1).
        //   [v]   composit final centralizado.
        const filter = [
            `[1:v]scale=${overlayWidth}:-1[wm]`,
            `[0:v][wm]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2[v]`,
        ].join(";");

        await runFfmpeg([
            "-y",
            "-i", inputPath,
            "-i", PRIVELLO_TEXT_PATH,
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
