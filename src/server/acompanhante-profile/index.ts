import { db } from "@/lib/db";

import type {
    CorOlhos,
    Etnia,
    EstiloCabelo,
    Idioma,
    TamanhoCabelo,
} from "@/domain/aparencia/definitions";
import type { Atende, Pratica } from "@/domain/atendimento";
import type {
    DiaSemana,
    FormaPagamento,
} from "@/domain/atendimentoComercial";
import { isBoostAtivo } from "@/domain/boost/definitions";
import { buildWhatsappUrl } from "@/domain/contato";
import type { Genero } from "@/domain/genero";

/**
 * Selo de plano exibido no perfil público. Discrimina três estados
 * mutuamente exclusivos:
 *
 * - `"BOOST"` — Acompanhante com boost ativo (`boostUntil > now()`).
 *   Tem prioridade visual sobre Premium.
 * - `"PREMIUM"` — plano Premium vigente, sem boost.
 * - `"BASICO"` — plano Básico vigente, sem boost.
 *
 * Quando não há plano vigente o perfil já cai no estado `HIDDEN` e
 * nem chega aqui — por isso o tipo não inclui `null`/`"NENHUM"`.
 */
export type PlanoExibicao = "BOOST" | "PREMIUM" | "BASICO";

/**
 * Campos comuns ao painel privado e ao perfil público da
 * Acompanhante. Tudo o que **não** é PII e que aparece tanto pra
 * dona do perfil quanto para visitantes anônimos vive aqui.
 *
 * Centralizar aqui evita duplicação entre `PerfilAcompanhantePainel`
 * e `PerfilAcompanhantePublico`. Adicionar um campo público novo é
 * uma alteração local nesta interface.
 *
 * Nenhum campo aqui pode ser PII (sem email, telefone, userId, etc).
 */
export interface PerfilAcompanhantePublicoBase {
    /** Handle público (parte após o `@`). */
    identificador: string;
    /** Nome de exibição. */
    nome: string;
    /** Localização separada em UF/cidade/bairro. */
    estadoSigla: string;
    cidadeNome: string;
    bairroNome: string | null;
    /** Texto livre exibido como bio. */
    descricao: string;
    /** URL da Foto_de_Perfil. */
    fotoUrl: string | null;
    /** URL da Capa_de_Perfil. */
    coverUrl: string | null;
    /** URL do Áudio_de_Apresentação ("Ouça minha voz"). */
    audioUrl: string | null;
    /** MIME type do áudio (necessário para o `<audio type>`). */
    audioMimeType: string | null;

    // Identidade e atendimento.
    genero: Genero | null;
    atendePublicos: ReadonlyArray<Atende>;
    realizaPraticas: ReadonlyArray<Pratica>;

    // Aparência (todos opcionais).
    pesoKg: number | null;
    alturaCm: number | null;
    tamanhoPe: number | null;
    etnia: Etnia | null;
    corOlhos: CorOlhos | null;
    estiloCabelo: EstiloCabelo | null;
    tamanhoCabelo: TamanhoCabelo | null;
    temSilicone: boolean | null;
    temTatuagens: boolean | null;
    temPiercing: boolean | null;
    fumante: boolean | null;
    idiomas: ReadonlyArray<Idioma>;

    // Atendimento comercial.
    /** Valor da hora em centavos (BRL). `null` quando ainda não preenchido. */
    valorHoraCents: number | null;
    /** Formas de pagamento aceitas. */
    formasPagamento: ReadonlyArray<FormaPagamento>;
    /** Dias da semana em que atende. */
    diasAtende: ReadonlyArray<DiaSemana>;

    // Contato e métricas públicas.
    /**
     * URL pronta do WhatsApp (`https://wa.me/55<digits>`) ou `null`
     * quando o telefone persistido não é um número BR válido. O
     * número raw NÃO entra no payload — só esta URL derivada.
     */
    whatsappUrl: string | null;
    /** Total agregado de visualizações. */
    viewsCount: number;
    /** Total de avaliações públicas recebidas. */
    reviewsCount: number;

    // Plano e destaque.
    /** Selo discriminado para o badge de plano (BOOST > PREMIUM > BASICO). */
    planoExibicao: PlanoExibicao;
}

/**
 * Forma do perfil consumida pela página pública
 * (`/acompanhantes/[slug]`). Espelha exatamente
 * {@link PerfilAcompanhantePublicoBase} — não tem PII e não tem flags
 * privadas.
 *
 * Como a Home/busca também serializa este objeto no RSC payload,
 * **qualquer campo adicionado aqui vira público**. Para campos
 * privados use {@link PerfilAcompanhantePainel}.
 */
export type PerfilAcompanhantePublico = PerfilAcompanhantePublicoBase;

/**
 * Forma do perfil consumida pelo painel privado da Acompanhante
 * (`/acompanhante`). Estende a forma pública com PII e flags
 * exclusivas da dona da conta.
 */
export interface PerfilAcompanhantePainel
    extends PerfilAcompanhantePublicoBase {
    /** ID interno do User. NÃO pode vazar pra rotas públicas. */
    userId: string;
    /** Email da conta. PII. */
    email: string;
    /** Telefone de contato. PII. */
    telefone: string;
    /**
     * Visibilidade do perfil público. Pertence ao painel pra que a
     * Acompanhante possa ligar/desligar via Switch. Não vai pro
     * objeto público porque o estado lógico já é refletido pelo
     * `PerfilPublicoEstado` retornado por `obterPerfilPublico`.
     */
    perfilVisivel: boolean;
}

/**
 * Alias retrocompatível. Código antigo importava
 * `PerfilAcompanhanteResumo` quando havia só um tipo único; novos
 * consumidores devem importar {@link PerfilAcompanhantePainel}
 * diretamente.
 *
 * @deprecated Use `PerfilAcompanhantePainel` (painel privado) ou
 *   `PerfilAcompanhantePublico` (perfil público).
 */
export type PerfilAcompanhanteResumo = PerfilAcompanhantePainel;

/**
 * Lê o perfil de painel (painel privado) da Acompanhante por
 * `userId`. Inclui PII — só pode ser usado em rotas autenticadas
 * onde o próprio usuário é a Acompanhante.
 *
 * Combina `User`, `AcompanhanteProfile`, a `Media` da Foto_de_Perfil,
 * a `Media` da Capa_de_Perfil e a `Media` do Áudio_de_Apresentação
 * em uma única consulta. Retorna `null` quando o `userId` não
 * corresponde a uma Acompanhante.
 */
export async function obterPerfilAcompanhante(
    userId: string,
): Promise<PerfilAcompanhantePainel | null> {
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId },
        include: {
            user: {
                select: {
                    nome: true,
                    email: true,
                    identificador: true,
                },
            },
            fotoPerfil: { select: { storageKey: true } },
            capaPerfil: { select: { storageKey: true } },
            audioApresentacao: {
                select: { storageKey: true, mimeType: true, status: true },
            },
        },
    });

    if (!profile) return null;

    const audioOk =
        profile.audioApresentacao &&
            profile.audioApresentacao.status === "COMMITTED"
            ? profile.audioApresentacao
            : null;

    const planoExibicao = resolverPlanoExibicao(
        profile.planoVigente,
        profile.boostUntil,
    );

    return {
        userId: profile.userId,
        nome: profile.user.nome,
        email: profile.user.email,
        identificador: profile.user.identificador,
        telefone: profile.telefone,
        estadoSigla: profile.estadoSigla,
        cidadeNome: profile.cidadeNome,
        bairroNome: profile.bairroNome,
        descricao: profile.descricao,
        fotoUrl: profile.fotoPerfil
            ? `/api/storage/${profile.fotoPerfil.storageKey}`
            : null,
        coverUrl: profile.capaPerfil
            ? `/api/storage/${profile.capaPerfil.storageKey}`
            : null,
        audioUrl: audioOk ? `/api/storage/${audioOk.storageKey}` : null,
        audioMimeType: audioOk ? audioOk.mimeType : null,

        perfilVisivel: profile.perfilVisivel,

        genero: profile.genero,
        atendePublicos: profile.atendePublicos,
        realizaPraticas: profile.realizaPraticas,

        pesoKg: profile.pesoKg,
        alturaCm: profile.alturaCm,
        tamanhoPe: profile.tamanhoPe,
        etnia: profile.etnia,
        corOlhos: profile.corOlhos,
        estiloCabelo: profile.estiloCabelo,
        tamanhoCabelo: profile.tamanhoCabelo,
        temSilicone: profile.temSilicone,
        temTatuagens: profile.temTatuagens,
        temPiercing: profile.temPiercing,
        fumante: profile.fumante,
        idiomas: profile.idiomas,

        valorHoraCents: profile.valorHoraCents,
        formasPagamento: profile.formasPagamento,
        diasAtende: profile.diasAtende,

        whatsappUrl: buildWhatsappUrl(profile.telefone),
        viewsCount: profile.viewsCount,
        reviewsCount: profile.reviewsCount,
        planoExibicao,
    };
}

/**
 * Resolve o {@link PlanoExibicao} discriminando entre Boost / Premium
 * / Básico. Boost tem prioridade sempre que `boostUntil` é maior que
 * `now()`. Quando o plano é nulo, retorna `"BASICO"` por default — o
 * caller (`obterPerfilPublico`) já filtra esse caso antes via
 * `HIDDEN`, então o branch quase nunca é exercido em produção; existe
 * apenas para que o tipo de retorno seja exhaustivo.
 */
function resolverPlanoExibicao(
    planoVigente: "BASICO" | "PREMIUM" | null,
    boostUntil: Date | null,
): PlanoExibicao {
    if (isBoostAtivo(boostUntil)) return "BOOST";
    if (planoVigente === "PREMIUM") return "PREMIUM";
    return "BASICO";
}

/**
 * Estado discriminado retornado por {@link obterPerfilPublico}.
 *
 * Cobre os 3 casos visíveis ao visitante anônimo de
 * `/acompanhantes/[slug]`:
 *
 * - `NOT_FOUND` — não existe Acompanhante com aquele `identificador`,
 *   ou o `User` foi deletado, ou o `identificador` pertence a um
 *   `Cliente`. Visitante vê 404 amigável.
 * - `HIDDEN` — perfil existe mas está oculto (toggle desligado pela
 *   Acompanhante OU plano vigente nulo). Visitante vê tela genérica
 *   "este perfil está oculto ou desativado".
 * - `OK` — perfil disponível com {@link PerfilAcompanhantePublico}
 *   (sem PII).
 */
export type PerfilPublicoEstado =
    | { state: "NOT_FOUND" }
    | { state: "HIDDEN" }
    | {
        state: "OK";
        /**
         * ID interno do `User`. **Não serializar diretamente para o
         * client** — usado pela própria page (RSC) para chamar
         * `listarGaleriaPublica` e `incrementarVisualizacao`. O
         * objeto `perfil` exposto ao client continua sem userId.
         */
        userId: string;
        perfil: PerfilAcompanhantePublico;
    };

/**
 * Lê o perfil público pelo `identificador` (a parte que vem após o
 * `@`). Sempre retorna um estado discriminado — nunca `null` — para
 * que a UI distinga `NOT_FOUND` de `HIDDEN` e renderize as duas telas
 * corretas.
 *
 * O `identificador` é tratado em caixa baixa (Requirement 2.4): a
 * busca normaliza para `lower()` antes de consultar. O resultado em
 * `OK` é uma {@link PerfilAcompanhantePublico} sem PII (sem email,
 * telefone ou userId interno) — seguro para serializar no payload
 * RSC público.
 */
export async function obterPerfilPublico(
    identificador: string,
): Promise<PerfilPublicoEstado> {
    const slug = identificador.trim().toLowerCase();
    if (slug.length === 0) return { state: "NOT_FOUND" };

    const profile = await db.acompanhanteProfile.findFirst({
        where: {
            user: { identificador: slug, type: "ACOMPANHANTE" },
        },
        include: {
            user: {
                select: { nome: true, identificador: true, type: true },
            },
            fotoPerfil: { select: { storageKey: true } },
            capaPerfil: { select: { storageKey: true } },
            audioApresentacao: {
                select: { storageKey: true, mimeType: true, status: true },
            },
        },
    });

    if (!profile) return { state: "NOT_FOUND" };
    if (profile.user.type !== "ACOMPANHANTE") return { state: "NOT_FOUND" };

    // Plano expirado / nunca escolhido cai no mesmo "oculto" para que
    // o visitante não veja perfis sem plano vigente. A diferenciação
    // fica no painel privado da Acompanhante.
    if (!profile.perfilVisivel || profile.planoVigente === null) {
        return { state: "HIDDEN" };
    }

    const audioOk =
        profile.audioApresentacao &&
            profile.audioApresentacao.status === "COMMITTED"
            ? profile.audioApresentacao
            : null;

    const planoExibicao = resolverPlanoExibicao(
        profile.planoVigente,
        profile.boostUntil,
    );

    const perfil: PerfilAcompanhantePublico = {
        nome: profile.user.nome,
        identificador: profile.user.identificador,
        estadoSigla: profile.estadoSigla,
        cidadeNome: profile.cidadeNome,
        bairroNome: profile.bairroNome,
        descricao: profile.descricao,
        fotoUrl: profile.fotoPerfil
            ? `/api/storage/${profile.fotoPerfil.storageKey}`
            : null,
        coverUrl: profile.capaPerfil
            ? `/api/storage/${profile.capaPerfil.storageKey}`
            : null,
        audioUrl: audioOk ? `/api/storage/${audioOk.storageKey}` : null,
        audioMimeType: audioOk ? audioOk.mimeType : null,

        genero: profile.genero,
        atendePublicos: profile.atendePublicos,
        realizaPraticas: profile.realizaPraticas,

        pesoKg: profile.pesoKg,
        alturaCm: profile.alturaCm,
        tamanhoPe: profile.tamanhoPe,
        etnia: profile.etnia,
        corOlhos: profile.corOlhos,
        estiloCabelo: profile.estiloCabelo,
        tamanhoCabelo: profile.tamanhoCabelo,
        temSilicone: profile.temSilicone,
        temTatuagens: profile.temTatuagens,
        temPiercing: profile.temPiercing,
        fumante: profile.fumante,
        idiomas: profile.idiomas,

        valorHoraCents: profile.valorHoraCents,
        formasPagamento: profile.formasPagamento,
        diasAtende: profile.diasAtende,

        whatsappUrl: buildWhatsappUrl(profile.telefone),
        viewsCount: profile.viewsCount,
        reviewsCount: profile.reviewsCount,
        planoExibicao,
    };

    return { state: "OK", userId: profile.userId, perfil };
}
