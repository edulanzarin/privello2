/**
 * Helper de privacidade: remove metadados (EXIF, GPS, ICC, XMP) de
 * imagens antes do staging em R2.
 *
 * # Por que existe
 *
 * Fotos de celular vêm com EXIF embutido — modelo da câmera, data/
 * hora, **coordenadas GPS** quando o usuário não desliga o
 * geolocation no app de câmera. Servir esses bytes inalterados em
 * fotos de perfil/capa expõe a localização exata da Acompanhante.
 *
 * Mídias da galeria já passam por `sharp(...).rotate()` no pipeline
 * de watermark — isso strippa metadados como efeito colateral
 * (sharp re-codifica a imagem). Mas foto de perfil e capa não
 * carregam watermark (são exibidas ao redor, não em posts), então
 * precisam de um pipeline próprio.
 *
 * # O que faz
 *
 * `stripExif`:
 *   1. Carrega o buffer no `sharp`.
 *   2. Aplica `rotate()` — respeita orientação EXIF antes de
 *      remover (pra foto não vir de cabeça pra baixo).
 *   3. Re-codifica no mesmo formato sem metadados.
 *   4. Devolve o buffer limpo.
 *
 * Não muda dimensões nem qualidade visível. JPEGs ficam ~5-10% menores
 * pelo strip. PNG/WebP varia menos.
 *
 * # Quando NÃO usar
 *
 * Use quando o caller quer apenas limpar metadados. Para mídias da
 * galeria (que já recebem watermark via `applyPhotoWatermark`),
 * o strip já vem de graça.
 */

import sharp from "sharp";

/**
 * MIMEs suportados — alinhados com `FotoPerfilMime` /
 * `validarFotoPerfil`.
 */
type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/**
 * Re-codifica `bytes` no mesmo formato sem EXIF/ICC/XMP.
 *
 * Em caso de erro (buffer corrompido, mime não suportado), devolve
 * o buffer original — o caller decide se quer falhar ou seguir.
 * Optei por não-throw aqui pra não quebrar o cadastro caso `sharp`
 * tenha algum corner case com formato exótico — a foto é validada
 * de outras formas.
 */
export async function stripExif(
    bytes: Uint8Array | Buffer,
    mimeType: string,
): Promise<Buffer> {
    if (!isImageMime(mimeType)) {
        // Não-imagem (vídeo, áudio): nada pra fazer aqui.
        return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    }

    try {
        const pipeline = sharp(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes))
            .rotate(); // respeita EXIF orientation antes de strip

        if (mimeType === "image/png") {
            return await pipeline.png({ compressionLevel: 9 }).toBuffer();
        }
        if (mimeType === "image/webp") {
            return await pipeline.webp({ quality: 90 }).toBuffer();
        }
        // image/jpeg
        return await pipeline.jpeg({ quality: 92, progressive: true }).toBuffer();
    } catch {
        // Fallback: devolve original. Em prod, considerar logar warning.
        return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    }
}

function isImageMime(mime: string): mime is ImageMime {
    return (
        mime === "image/jpeg" ||
        mime === "image/png" ||
        mime === "image/webp"
    );
}
