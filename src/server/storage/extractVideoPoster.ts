/**
 * Extrai um frame estático de um vídeo pra usar como "poster"
 * (thumbnail enquanto o vídeo carrega).
 *
 * # Por que existe
 *
 * Reels e Stories em vídeo carregam preto enquanto o `<video>`
 * baixa metadados. UX ruim — usuário vê retângulo preto no feed.
 * Soluções:
 *
 *   1. `<video preload="metadata">` (default) — Safari mostra
 *      preto até `seek(0)`.
 *   2. `<video poster="url">` — atributo nativo HTML que mostra
 *      uma imagem fixa até dar play. Browsers respeitam em
 *      todos os casos.
 *
 * Esta função roda durante o pipeline de publicação (após o
 * watermark mas antes do commit em R2). Captura o frame ~0.5s
 * (evita primeiros frames pretos de fade-in) e codifica em JPEG
 * de baixa qualidade (~70%) — poster pequeno (50-150 KB) carrega
 * rapidíssimo.
 *
 * # Falhas
 *
 * Se `ffmpeg-static` não estiver disponível ou o vídeo estiver
 * corrompido, devolvemos `null`. Caller continua o fluxo sem
 * poster (vídeo carrega preto até metadata) — não é fatal.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import ffmpegStatic from "ffmpeg-static";

const ffmpegPath: string | null = (() => {
    const value = ffmpegStatic as unknown;
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "default" in value) {
        const d = (value as { default?: unknown }).default;
        if (typeof d === "string") return d;
    }
    return null;
})();

/**
 * Mapa MIME → extensão de container, idêntico ao usado no
 * watermark. FFmpeg infere o demuxer pela extensão do file
 * temporário.
 */
const MIME_TO_EXT: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
};

/**
 * Captura um frame e devolve o JPEG. Retorna `null` em caso de
 * falha (sem ffmpeg, vídeo inválido, timeout).
 *
 * @param bytes Bytes do vídeo (já com watermark se for o caso).
 * @param mimeType MIME original do vídeo.
 * @param atSeconds Posição do frame em segundos. Padrão 0.5s.
 */
export async function extractVideoPoster(
    bytes: Uint8Array | Buffer,
    mimeType: string,
    atSeconds: number = 0.5,
): Promise<Buffer | null> {
    if (!ffmpegPath) return null;

    const ext = MIME_TO_EXT[mimeType];
    if (!ext) return null;

    const tmpDir = os.tmpdir();
    const id = randomUUID();
    const inputPath = path.join(tmpDir, `priv-poster-${id}.${ext}`);
    const outputPath = path.join(tmpDir, `priv-poster-${id}.jpg`);

    try {
        const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
        await fs.promises.writeFile(inputPath, buf);

        const ok = await runFfmpegPoster(inputPath, outputPath, atSeconds);
        if (!ok) return null;

        if (!fs.existsSync(outputPath)) return null;
        return await fs.promises.readFile(outputPath);
    } catch {
        return null;
    } finally {
        // Cleanup — não throw em erro de unlink (arquivo já pode
        // não existir).
        await fs.promises.unlink(inputPath).catch(() => undefined);
        await fs.promises.unlink(outputPath).catch(() => undefined);
    }
}

/**
 * Roda `ffmpeg -ss <t> -i <in> -frames:v 1 -q:v 4 <out>`. O `-q:v 4`
 * dá qualidade ~70% (1=melhor, 31=pior). Resolve em `true` quando
 * exitcode 0 e no timeout/erro retorna `false`.
 */
function runFfmpegPoster(
    inputPath: string,
    outputPath: string,
    atSeconds: number,
): Promise<boolean> {
    if (!ffmpegPath) return Promise.resolve(false);
    const bin = ffmpegPath;

    return new Promise((resolve) => {
        const args = [
            "-y",
            // `-ss` ANTES do `-i` faz seek rápido (não-preciso),
            // suficiente pra um poster estético.
            "-ss",
            String(atSeconds),
            "-i",
            inputPath,
            "-frames:v",
            "1",
            "-q:v",
            "4",
            // Limita resolução pra controlar tamanho do poster:
            // máx 720px na maior dimensão.
            "-vf",
            "scale='min(720,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
            outputPath,
        ];

        const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            resolve(ok);
        };

        // Timeout: poster é leve, 15s é mais que suficiente.
        const timeout = setTimeout(() => {
            proc.kill("SIGKILL");
            finish(false);
        }, 15_000);

        proc.on("error", () => {
            clearTimeout(timeout);
            finish(false);
        });
        proc.on("exit", (code) => {
            clearTimeout(timeout);
            finish(code === 0);
        });
    });
}
