/**
 * Definições canônicas dos planos da Privello.
 *
 * Esta é a única fonte de verdade para os limites e benefícios de
 * `Plano_Basico` e `Plano_Premium`, conforme Requirements 5.1, 5.2 e 5.3.
 *
 * A constante {@link PLANO_DEFINITIONS} é imutável tanto em tempo de
 * compilação (via `as const`) quanto em runtime (via `Object.freeze`),
 * para evitar mutação acidental por consumidores.
 */

/**
 * Tipos de plano suportados pela plataforma.
 *
 * Mapeia 1:1 para o enum `PlanoTipo` do Prisma (`prisma/schema.prisma`).
 */
export type PlanoTipo = "BASICO" | "PREMIUM";

/**
 * Definição estrutural de um plano.
 *
 * - `tipo`: identificador do plano.
 * - `tier`: ordem hierárquica entre planos (0 = mais básico, valores
 *   maiores = mais avançados). Usado para regular upgrade/downgrade:
 *   `tier(novo) >= tier(atual)` é o invariante para qualquer mudança
 *   de plano. Downgrade ativo é proibido.
 * - `limiteMidias`: número máximo de mídias adicionais à Foto_de_Perfil.
 * - `permiteStories`: indica se o plano habilita publicação de Stories.
 * - `prioridadeBusca`: indica se o plano confere prioridade em buscas.
 * - `permiteAudio`: indica se o plano habilita o Áudio_de_Apresentação
 *   ("Ouça minha voz") — recurso exclusivo do `Plano_Premium`.
 */
export type PlanoDefinition = {
    tipo: PlanoTipo;
    tier: number;
    limiteMidias: number;
    permiteStories: boolean;
    prioridadeBusca: boolean;
    permiteAudio: boolean;
    /**
     * Indica se o plano habilita publicação de Reels — vídeos
     * curtos que aparecem no feed `/reels`.
     */
    permiteReels: boolean;
    /**
     * Limite de Reels publicados simultaneamente. `Infinity` para
     * Premium (sem teto prático).
     */
    limiteReels: number;
};

/**
 * Catálogo imutável de planos.
 *
 * Os valores foram derivados literalmente dos Requirements 5.2 e 5.3:
 *
 * - `BASICO` (tier 0): até 10 mídias, sem Stories, sem prioridade,
 *   sem áudio.
 * - `PREMIUM` (tier 1): até 50 mídias, com Stories, prioridade em
 *   busca e áudio ("Ouça minha voz").
 */
export const PLANO_DEFINITIONS = Object.freeze({
    BASICO: Object.freeze({
        tipo: "BASICO",
        tier: 0,
        limiteMidias: 10,
        permiteStories: false,
        prioridadeBusca: false,
        permiteAudio: false,
        permiteReels: true,
        limiteReels: 20,
    }),
    PREMIUM: Object.freeze({
        tipo: "PREMIUM",
        tier: 1,
        limiteMidias: 50,
        permiteStories: true,
        prioridadeBusca: true,
        permiteAudio: true,
        permiteReels: true,
        limiteReels: Number.POSITIVE_INFINITY,
    }),
} as const) satisfies Readonly<Record<PlanoTipo, PlanoDefinition>>;

/**
 * Type guard que valida se um valor desconhecido é um `PlanoTipo`.
 *
 * Aceita apenas as strings `"BASICO"` e `"PREMIUM"` exatamente como
 * definidas em {@link PLANO_DEFINITIONS}. Comparação é case-sensitive.
 */
export function isPlanoTipo(value: unknown): value is PlanoTipo {
    return value === "BASICO" || value === "PREMIUM";
}

/**
 * Recupera a definição imutável de um plano a partir do seu tipo.
 *
 * O retorno é exatamente o mesmo objeto congelado armazenado em
 * {@link PLANO_DEFINITIONS}; consumidores não devem tentar mutá-lo.
 */
export function getPlanoDefinition(tipo: PlanoTipo): PlanoDefinition {
    return PLANO_DEFINITIONS[tipo];
}

/**
 * Verifica se uma mudança de plano é permitida.
 *
 * Regras:
 * - **Upgrade** (`tier(alvo) > tier(atual)`): permitido. A
 *   Acompanhante ganha mais recursos imediatamente.
 * - **Lateral** (`tier(alvo) === tier(atual)`): permitido (apenas
 *   o mesmo plano, idempotente — `selecionar` trata isso).
 * - **Downgrade** (`tier(alvo) < tier(atual)`): **proibido**.
 *   Quem já paga o Premium não pode "voltar" para o Básico
 *   ativamente; o downgrade só ocorre por inadimplência (plano
 *   expira, `planoVigente` vira `null`).
 *
 * Quando `atual === null` (Acompanhante ainda não escolheu plano),
 * qualquer alvo válido é permitido — é a primeira escolha pós-cadastro.
 */
export function podeAlterarPlano(
    atual: PlanoTipo | null,
    alvo: PlanoTipo,
): boolean {
    if (atual === null) return true;
    return PLANO_DEFINITIONS[alvo].tier >= PLANO_DEFINITIONS[atual].tier;
}
