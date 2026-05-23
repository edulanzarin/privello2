/**
 * Sistema_de_Onboarding — barrel de exportações.
 *
 * Concentra a API pública do serviço de Onboarding_Acompanhante
 * (Requirement 3). Consumidores devem importar daqui em vez de tocar
 * arquivos internos.
 */

export {
    iniciar,
    atualizarEtapa,
    obter,
    uploadFoto,
    descartar,
    serializeOnboardingCookie,
    parseOnboardingCookie,
    DraftNotFoundError,
    DraftExpiredError,
    InvalidFotoPerfilError,
    DRAFT_TTL_MS,
    ONBOARDING_COOKIE_NAME,
    ONBOARDING_COOKIE_MAX_AGE_SECONDS,
    type DraftPayload,
} from "./drafts";

export {
    finalizar,
    type FinalizarResult,
    type FinalizarFailureReason,
} from "./finalizar";
