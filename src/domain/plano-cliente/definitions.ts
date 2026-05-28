/**
 * Definições canônicas dos planos de Cliente da Privello.
 *
 * O Cliente tem dois tipos de plano vigente:
 *
 * - `GRATIS` (default): visualiza perfis públicos, fotos da galeria,
 *   áudio e Stories. Não pode avaliar, ler avaliações de outros,
 *   comentar, ler comentários, curtir nem perguntar.
 * - `FAN`: tudo do gratuito + ler/publicar avaliações, ler/escrever
 *   comentários, curtir mídias e Stories, perguntar e ler perguntas.
 *
 * # Duração do Fan
 *
 * O `FAN` é vendido em 3 durações:
 *
 *   - **24h** (R$ 3,99) — entrada rápida pra "ver agora".
 *   - **7 dias** (R$ X) — fim de semana / período de teste.
 *   - **30 dias** (R$ Y) — assinatura padrão.
 *
 * Todas as durações conferem o mesmo conjunto de benefícios. A
 * diferença está apenas em quanto tempo o `ClientProfile.planoExpiraEm`
 * fica no futuro. Quando expira, o Cliente vira `GRATIS`
 * automaticamente (downgrade lazy no read).
 */

/**
 * Tipos de plano de Cliente. Mapeia 1:1 para o enum `PlanoClienteTipo`
 * do Prisma (`prisma/schema.prisma`).
 */
export type PlanoClienteTipo = "GRATIS" | "FAN";

/**
 * Durações disponíveis para o plano `FAN`. Cada uma vira um item
 * separado na tela de seleção de plano.
 */
export type PlanoClienteDuracao = "FAN_24H" | "FAN_7D" | "FAN_30D";

/**
 * Definição estrutural de um plano de Cliente — só descreve as
 * **capacidades**, não a duração. Duração vive em
 * {@link PLANO_CLIENTE_DURACOES} separadamente.
 *
 * `tier` regula a hierarquia. `GRATIS` tier 0, `FAN` tier 1.
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
    /** Pode publicar perguntas em perfis de Acompanhantes. */
    podePerguntar: boolean;
    /** Pode ler perguntas/respostas em perfis. */
    podeVerPerguntas: boolean;
};

/**
 * Catálogo imutável de planos de Cliente.
 */
export const PLANO_CLIENTE_DEFINITIONS = Object.freeze({
    GRATIS: Object.freeze({
        tipo: "GRATIS",
        tier: 0,
        podeAvaliar: false,
        podeVerAvaliacoes: false,
        podeVerComentarios: false,
        podeComentar: false,
        podeCurtir: false,
        podeVerStories: true,
        podePerguntar: false,
        podeVerPerguntas: false,
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
        podePerguntar: true,
        podeVerPerguntas: true,
    }),
} as const) satisfies Readonly<
    Record<PlanoClienteTipo, PlanoClienteDefinition>
>;

/**
 * Descreve uma opção de compra do plano `FAN` — duração + preço.
 */
export interface PlanoClienteDuracaoDef {
    chave: PlanoClienteDuracao;
    label: string;
    /** Duração em milissegundos. */
    duracaoMs: number;
    /** Preço em centavos (BRL). */
    precoCents: number;
    /** Texto curto pra UI mostrar valor por dia (ex.: "R$ 3,99 por 1 dia"). */
    descricaoCurta: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Catálogo imutável de durações vendáveis do plano `FAN`.
 *
 * Os preços iniciais são placeholders editáveis pelo time de
 * produto. Quando o Mercado Pago real for plugado, as durações
 * apontam pra IDs distintos no MP (ou usam `external_reference`
 * com prefixo).
 */
export const PLANO_CLIENTE_DURACOES = Object.freeze({
    FAN_24H: Object.freeze({
        chave: "FAN_24H",
        label: "Fan 24h",
        duracaoMs: ONE_DAY_MS,
        precoCents: 399,
        descricaoCurta: "Acesso completo por 24 horas",
    }),
    FAN_7D: Object.freeze({
        chave: "FAN_7D",
        label: "Fan 7 dias",
        duracaoMs: 7 * ONE_DAY_MS,
        precoCents: 1990,
        descricaoCurta: "1 semana de acesso completo",
    }),
    FAN_30D: Object.freeze({
        chave: "FAN_30D",
        label: "Fan 30 dias",
        duracaoMs: 30 * ONE_DAY_MS,
        precoCents: 4990,
        descricaoCurta: "1 mês de acesso completo",
    }),
} as const) satisfies Readonly<
    Record<PlanoClienteDuracao, PlanoClienteDuracaoDef>
>;

/**
 * Type guard: valor é um `PlanoClienteTipo` válido.
 */
export function isPlanoClienteTipo(
    value: unknown,
): value is PlanoClienteTipo {
    return value === "GRATIS" || value === "FAN";
}

/**
 * Type guard: valor é uma chave de duração válida (`FAN_24H` etc).
 */
export function isPlanoClienteDuracao(
    value: unknown,
): value is PlanoClienteDuracao {
    return (
        value === "FAN_24H" || value === "FAN_7D" || value === "FAN_30D"
    );
}

/**
 * Recupera a definição imutável de um plano a partir do seu tipo.
 */
export function getPlanoClienteDefinition(
    tipo: PlanoClienteTipo,
): PlanoClienteDefinition {
    return PLANO_CLIENTE_DEFINITIONS[tipo];
}

/**
 * Recupera a definição imutável de uma duração de Fan.
 */
export function getPlanoClienteDuracao(
    chave: PlanoClienteDuracao,
): PlanoClienteDuracaoDef {
    return PLANO_CLIENTE_DURACOES[chave];
}

/**
 * Verifica se uma mudança de plano de Cliente é permitida.
 *
 * Downgrade ativo proibido (`FAN → GRATIS`); upgrade e idempotência
 * permitidos. Renovar/estender o `FAN` (comprar 24h em cima de 24h
 * existente) é tratado em camada superior — aqui só validamos o
 * shape `tipo`.
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
