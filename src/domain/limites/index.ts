/**
 * Fonte única de verdade para limites de tamanho de uploads.
 *
 * Unifica os tetos consumidos por:
 *   - validators do domínio (`validarFotoPerfil`, `validarCapaPerfil`,
 *     `validarGaleriaMidia`, `validarAudioApresentacao`);
 *   - primitivos de UI (`MediaUpload`, `MediaUploadModal`);
 *   - mensagens de erro client/server.
 *
 * Os números foram calibrados para uso real em mobile:
 *
 *   - **Foto** (perfil, capa, galeria): **8 MiB**. Cobre fotos de
 *     celular moderno (3-6 MB JPEG comprimido) com folga, sem
 *     incentivar PNGs gigantes.
 *   - **Vídeo** (galeria): **50 MiB**. Cobre clipes de até ~1 min em
 *     1080p H.264. Bandwidth e storage R2 ficam razoáveis.
 *   - **Áudio** (apresentação): **5 MiB**. 60s em Opus = ~600 KB,
 *     com folga até pra Safari (que gera arquivos maiores).
 *
 * Mudar um valor aqui propaga para validador, UI e mensagens
 * automaticamente.
 */

const MIB = 1024 * 1024;

/** Tamanho máximo de foto (perfil, capa, galeria). 8 MiB. */
export const LIMITE_FOTO_BYTES = 8 * MIB;

/** Tamanho máximo de vídeo na galeria. 50 MiB. */
export const LIMITE_VIDEO_BYTES = 50 * MIB;

/** Tamanho máximo de áudio de apresentação. 5 MiB. */
export const LIMITE_AUDIO_BYTES = 5 * MIB;

/**
 * Helper formatador "X MB" para mensagens de UI. Usa MiB
 * arredondado pra inteiro — usuários não distinguem MB de MiB e
 * o número fica mais redondo.
 */
export function formatarLimiteMb(bytes: number): string {
    return `${Math.round(bytes / MIB)} MB`;
}
