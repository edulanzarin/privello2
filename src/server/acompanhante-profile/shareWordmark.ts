/**
 * Wordmark da marca pros cards de compartilhamento (perfil e cidade).
 *
 * Centraliza o rodapé "ícone da marca (flame) + Privello" — igual à
 * top bar — pra que os dois geradores de card (`shareCard`,
 * `shareCityCard`) fiquem visualmente idênticos e mudem juntos.
 *
 * O ícone vem de `public/logo.png` (mesma imagem do `<Logo>`); o
 * texto é renderizado no SVG de overlay de cada card.
 */

import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";

/** Lado do logo (px) no canvas 1080×1920 dos cards. */
export const WORDMARK_LOGO_SIZE = 96;
/** Margem esquerda do wordmark. */
export const WORDMARK_LEFT = 64;
/** Baseline do texto "Privello". */
export const WORDMARK_TEXT_BASELINE = 1852;
/** X do texto, logo após o ícone. */
export const WORDMARK_TEXT_X = WORDMARK_LEFT + WORDMARK_LOGO_SIZE + 22;
/** Topo do logo, alinhado ao centro visual do texto. */
export const WORDMARK_LOGO_TOP = WORDMARK_TEXT_BASELINE - 84;

/**
 * Trecho `<text>` do SVG de overlay que desenha "Privello" na
 * posição padrão do wordmark. O caller injeta dentro do seu `<svg>`.
 */
export function wordmarkTextSvg(): string {
    return `<text x="${WORDMARK_TEXT_X}" y="${WORDMARK_TEXT_BASELINE}" font-family="sans-serif" font-size="60" font-weight="700" fill="#ffffff">Privello</text>`;
}

/**
 * Carrega o ícone da marca (`public/logo.png`) redimensionado pro
 * tamanho do wordmark. Retorna `null` se o arquivo não existir/falhar
 * — nesse caso o card sai só com o texto "Privello" (degradação
 * suave, não derruba a geração).
 */
export async function carregarLogoMarca(): Promise<Buffer | null> {
    try {
        const logoPath = path.join(process.cwd(), "public", "logo.png");
        const bytes = await fs.promises.readFile(logoPath);
        return await sharp(bytes)
            .resize(WORDMARK_LOGO_SIZE, WORDMARK_LOGO_SIZE, { fit: "contain" })
            .png()
            .toBuffer();
    } catch {
        return null;
    }
}

/**
 * Monta a lista de camadas (`sharp.OverlayOptions[]`) do composite
 * final: o `overlay` SVG do card + o logo da marca (quando
 * disponível) posicionado no rodapé.
 */
export function camadasComWordmark(
    overlay: Buffer,
    logoMarca: Buffer | null,
): sharp.OverlayOptions[] {
    const camadas: sharp.OverlayOptions[] = [
        { input: overlay, top: 0, left: 0 },
    ];
    if (logoMarca) {
        camadas.push({
            input: logoMarca,
            top: WORDMARK_LOGO_TOP,
            left: WORDMARK_LEFT,
        });
    }
    return camadas;
}
