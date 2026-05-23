/**
 * Barrel de validações de domínio.
 *
 * Reexporta os validadores e helpers de normalização para que as camadas
 * de aplicação (`src/server`) e UI (`src/components`, `src/app`)
 * consumam a mesma fonte canônica de regras descritas pelos
 * Requirements 2 e 3.
 */

export { validarNome, normalizarNome } from "./nome";
export { validarEmail, normalizarEmail } from "./email";
export {
    validarIdentificadorFormato,
    normalizarIdentificador,
    IDENTIFICADOR_PATTERN,
} from "./identificador";
export { validarSenha } from "./senha";
export { validarTelefone, normalizarTelefone } from "./telefone";
export { validarDescricao } from "./descricao";
export {
    validarFotoPerfil,
    MIME_TYPES_PERMITIDOS,
    TAMANHO_MAXIMO_BYTES,
} from "./fotoPerfil";
export type { FotoPerfilInput, FotoPerfilMime } from "./fotoPerfil";

export {
    validarCapaPerfil,
    CAPA_MIME_TYPES,
    CAPA_TAMANHO_MAXIMO_BYTES,
} from "./capaPerfil";
export type { CapaPerfilInput, CapaPerfilMime } from "./capaPerfil";

export {
    classificarMidia,
    validarGaleriaMidia,
    validarGaleriaDescricao,
    GALERIA_MIME_FOTOS,
    GALERIA_MIME_VIDEOS,
    GALERIA_TAMANHO_MAXIMO_FOTO_BYTES,
    GALERIA_TAMANHO_MAXIMO_VIDEO_BYTES,
    GALERIA_DESCRICAO_MAX,
} from "./galeriaMidia";
export type {
    GaleriaTipo,
    GaleriaMime,
    GaleriaMimeFoto,
    GaleriaMimeVideo,
    GaleriaMidiaInput,
} from "./galeriaMidia";

export {
    validarAudioApresentacao,
    audioApresentacaoExt,
    AUDIO_APRESENTACAO_MIME_TYPES,
    AUDIO_APRESENTACAO_TAMANHO_MAXIMO_BYTES,
    AUDIO_APRESENTACAO_DURACAO_MINIMA_S,
    AUDIO_APRESENTACAO_DURACAO_MAXIMA_S,
} from "./audioApresentacao";
export type {
    AudioApresentacaoInput,
    AudioApresentacaoMime,
} from "./audioApresentacao";
