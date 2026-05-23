/**
 * Dev-only route that serves files from `.storage/` on disk.
 * In production, files are served directly from R2 via presigned URLs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { NextResponse, type NextRequest } from "next/server";

const STORAGE_DIR = path.resolve(process.cwd(), ".storage");

const MIME_MAP: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    // Áudio_de_Apresentação. `webm` aqui pode ser audio/webm também
    // — o Content-Type final só importa para o `<audio>` tag e os
    // browsers ignoram o tipo quando o container traz a stream
    // correta. Mantemos `video/webm` no map porque servir áudio
    // dentro de `audio/webm` funciona idêntico.
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
};

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { key } = await params;
    const filePath = path.join(STORAGE_DIR, ...key);

    if (!filePath.startsWith(STORAGE_DIR)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";
    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Cache-Control": "no-store",
        },
    });
}
