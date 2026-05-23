/**
 * Definições canônicas dos planos de Cliente da Privello.
 *
 * Espelha a estrutura do `Sistema_de_Planos` da Acompanhante
 * (`@/domain/plano/definitions`), mas com o conjunto de benefícios
 * próprio do Cliente:
 *
 * - `GRATIS`: usuário pode ver Stories normalmente, criar avaliações
 *   para Acompanhantes que conheceu, e usar a busca padrão. Não pode
 *   ler avaliações alheias, ler/postar comentários em fotos, nem
 *   curtir mídias.
 * - `FAN`: tudo do gratuito, acrescido de:
 *     - leitura de avaliações de outros Clientes,
 *     - leitura e escrita de comentários em fotos,
 *     - curtir fotos e Stories.
 *
 * A constante {@link PLANO_CLIENTE_DEFINITIONS} é imutável tanto em
 * tempo de compilação (`as const`) quanto em runtime (`Object.freeze`),
 * para evitar mutação acidental por consumidores. Mapeia 1:1 para o
 * enum `PlanoClienteTipo` do Prisma.
 */

/**
 * Tipos de plano de Cliente. Mapeia 1:1 para o enum `PlanoClienteTipo`
 * do Prisma (`prisma/schema.prisma`).
 */
export type PlanoClienteTipo = "GRATIS" | "FAN";

/**
 * Definição estrutural de um plano de Cliente.
 *
 * Cada flag descreve uma capacidade discreta da plataforma. As páginas
 * que precisam decidir "mostrar isso ou não" devem ler diretamente as
 * flags, evitando comparar `tipo === "FAN"` espalhado pela base.
 *
 * `tier` regula a hierarquia (mesma semântica de `PlanoDefinition` da
 * Acompanhante): downgrade ativo é proibido. `GRATIS` tier 0,
 * `FAN` tier 1.
 */
export type PlanoClienteDefinition = {
    tipo: PlanoClienteTipo;
    tier: number;
    /** Pode publicar avaliações sobre Acompanhantes. */
    podeAvaliar: boolean;
    /** Pode ler avaliações de outros Clientes. */
    podeVerAvaliacoes: boolean;
    /** Pode ler comentários em fotos de Acompanhantes. */
    podeVerComentarios: boolean;
    /** Pode publicar comentários em fotos. */
    podeComentar: boolean;
    /** Pode curtir fotos e Stories. */
    podeCurtir: boolean;
    /** Pode visualizar Stories. */
    podeVerStories: boolean;
};

/**
 * Catálogo imutável de planos de Cliente.
 *
 * Os valores foram derivados do design:
 *
 * - `GRATIS` (tier 0): ver Stories, avaliar (sem ler avaliações alheias).
 * - `FAN` (tier 1): tudo do gratuito + leitura de avaliações + comentários + curtidas.
 */
export const PLANO_CLIENTE_DEFINITIONS = Object.freeze({
    GRATIS: Object.freeze({
        tipo: "GRATIS",
        tier: 0,
        podeAvaliar: true,
        podeVerAvaliacoes: false,
        podeVerComentarios: false,
        podeComentar: false,
        podeCurtir: false,
        podeVerStories: true,
    }),
    FAN: Object.freeze({
        tipo: "FAN",
        tier: 1,
        podeAvaliar: true,
        podeVerAvaliacoes: true,
        podeVerComentarios: true,
        podeComentar: true,
        podeCurtir: true,
        podeVerStories: true,
    }),
} as const) satisfies Readonly<
    Record<PlanoClienteTipo, PlanoClienteDefinition>
>;

/**
 * Type guard que valida se um valor desconhecido é um `PlanoClienteTipo`.
 *
 * Aceita apenas as strings `"GRATIS"` e `"FAN"` exatamente como
 * definidas em {@link PLANO_CLIENTE_DEFINITIONS}. Comparação é
 * case-sensitive.
 */
export function isPlanoClienteTipo(
    value: unknown,
): value is PlanoClienteTipo {
    return value === "GRATIS" || value === "FAN";
}

/**
 * Recupera a definição imutável de um plano a partir do seu tipo.
 *
 * O retorno é exatamente o mesmo objeto congelado armazenado em
 * {@link PLANO_CLIENTE_DEFINITIONS}; consumidores não devem mutá-lo.
 */
export function getPlanoClienteDefinition(
    tipo: PlanoClienteTipo,
): PlanoClienteDefinition {
    return PLANO_CLIENTE_DEFINITIONS[tipo];
}

/**
 * Verifica se uma mudança de plano de Cliente é permitida. Mesma
 * semântica de `podeAlterarPlano` em `@/domain/plano/definitions`:
 * downgrade ativo proibido (`FAN → GRATIS`); upgrade e idempotência
 * permitidos.
 */
export function podeAlterarPlanoCliente(
    atual: PlanoClienteTipo | null,
    alvo: PlanoClienteTipo,
): boolean {
    if (atual === null) return true;
    return (
        PLANO_CLIENTE_DEFINITIONS[alvo].tier >=
        PLANO_CLIENTE_DEFINITIONS[atual].tier
    );
}
