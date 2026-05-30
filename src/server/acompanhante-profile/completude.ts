/**
 * Completude do perfil da Acompanhante.
 *
 * Calcula um percentual e uma lista de itens faltantes pra mostrar
 * no painel privado um nudge "complete seu perfil pra atrair mais
 * Cliente". Não tem efeito direto no algoritmo de busca/ranking — é
 * gamification visual: barra de progresso + lista de itens
 * faltantes com link direto pro lugar onde se preenche.
 *
 * # Checklist
 *
 * 9 itens, peso igual entre todos (cada um vale ~11%):
 *
 * 1. Foto de perfil publicada.
 * 2. Capa de perfil publicada.
 * 3. Descrição com pelo menos 100 caracteres.
 * 4. Áudio de apresentação publicado.
 * 5. Identidade verificada.
 * 6. Pelo menos 5 mídias na galeria.
 * 7. Pelo menos 1 Story já publicado (ativos ou arquivados).
 * 8. Todos os campos de aparência preenchidos (peso, altura, pé,
 *    etnia, olhos, cabelo estilo, cabelo tamanho).
 * 9. Pelo menos 1 dia de atendimento + 1 forma de pagamento
 *    selecionados.
 *
 * Cada item devolvido na lista carrega um `key` (estável, usado
 * como react key e como categoria pra steering futuro), um `label`
 * humano e um `href` opcional pra UI linkar diretamente. O
 * `href` aponta pra hash de aba `/acompanhante#tab` ou
 * `/acompanhante/<rota>` — caller renderiza com `<Link>` ou
 * `LinkButton`.
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Chave estável por item da checklist. */
export type CompletudeItemKey =
    | "foto_perfil"
    | "capa"
    | "descricao"
    | "audio"
    | "verificacao"
    | "galeria"
    | "stories"
    | "aparencia"
    | "atendimento";

export interface CompletudeItem {
    key: CompletudeItemKey;
    /** Texto humano do que falta (ou foi feito). */
    label: string;
    /** `true` quando o item já foi cumprido. */
    completo: boolean;
    /**
     * Link interno onde o usuário vai pra cumprir o item. Tipicamente
     * uma hash de aba do painel.
     */
    href: string;
}

export interface CompletudeResultado {
    /** Percentual entre 0 e 100, inteiro. */
    percentual: number;
    /** Quantos itens cumpridos. */
    completos: number;
    /** Quantos itens existem na checklist. */
    total: number;
    /** Lista ordenada de itens (cumpridos no fim, faltantes no topo). */
    itens: ReadonlyArray<CompletudeItem>;
}

// ---------------------------------------------------------------------------
// Lógica
// ---------------------------------------------------------------------------

const DESC_MIN_CHARS = 100;
const GALERIA_MIN = 5;

/**
 * Lê os dados do perfil + agregados (galeria, stories, verificação)
 * em queries paralelas e devolve a estrutura completa.
 *
 * Performance: 4 queries paralelas (perfil, galeria count, stories
 * count, verificação). Bom o suficiente pro painel — chamada apenas
 * 1x por render.
 */
export async function obterCompletude(
    userId: string,
): Promise<CompletudeResultado> {
    const [perfil, galeriaCount, storiesCount, verificacao] = await Promise.all([
        db.acompanhanteProfile.findUnique({
            where: { userId },
            select: {
                fotoPerfilId: true,
                capaPerfilId: true,
                descricao: true,
                audioApresentacaoId: true,
                verificada: true,
                pesoKg: true,
                alturaCm: true,
                tamanhoPe: true,
                etnia: true,
                corOlhos: true,
                estiloCabelo: true,
                tamanhoCabelo: true,
                diasAtende: true,
                formasPagamento: true,
            },
        }),
        db.media.count({
            where: {
                ownerId: userId,
                role: "GALLERY",
                status: "COMMITTED",
            },
        }),
        // Stories ativos OU arquivados (qualquer publicação histórica
        // conta — basta o usuário ter experimentado a feature).
        db.media.count({
            where: {
                ownerId: userId,
                role: "STORY",
                status: { in: ["COMMITTED", "DELETED"] },
            },
        }),
        db.verification.findUnique({
            where: { userId },
            select: { status: true },
        }),
    ]);

    // Perfil pode estar nulo se a função for chamada por engano com
    // userId de Cliente — defesa.
    if (!perfil) {
        return {
            percentual: 0,
            completos: 0,
            total: 0,
            itens: [],
        };
    }

    const aparenciaCompleta =
        perfil.pesoKg !== null &&
        perfil.alturaCm !== null &&
        perfil.tamanhoPe !== null &&
        perfil.etnia !== null &&
        perfil.corOlhos !== null &&
        perfil.estiloCabelo !== null &&
        perfil.tamanhoCabelo !== null;

    const atendimentoCompleto =
        perfil.diasAtende.length > 0 && perfil.formasPagamento.length > 0;

    const itens: CompletudeItem[] = [
        {
            key: "foto_perfil",
            label: "Adicione foto de perfil",
            completo: perfil.fotoPerfilId !== null,
            href: "/acompanhante#perfil",
        },
        {
            key: "capa",
            label: "Adicione capa do perfil",
            completo: perfil.capaPerfilId !== null,
            href: "/acompanhante#perfil",
        },
        {
            key: "descricao",
            label: `Escreva uma bio com ao menos ${DESC_MIN_CHARS} caracteres`,
            completo: perfil.descricao.trim().length >= DESC_MIN_CHARS,
            href: "/acompanhante#perfil",
        },
        {
            key: "audio",
            label: "Grave o áudio de apresentação",
            completo: perfil.audioApresentacaoId !== null,
            href: "/acompanhante#audio",
        },
        {
            key: "verificacao",
            label: "Verifique sua identidade",
            completo:
                perfil.verificada === true &&
                verificacao?.status === "APROVADA",
            href: "/acompanhante#verificacao",
        },
        {
            key: "galeria",
            label: `Publique ao menos ${GALERIA_MIN} mídias na galeria`,
            completo: galeriaCount >= GALERIA_MIN,
            href: "/acompanhante#midias",
        },
        {
            key: "stories",
            label: "Publique ao menos 1 Story",
            completo: storiesCount >= 1,
            href: "/acompanhante#midias",
        },
        {
            key: "aparencia",
            label: "Preencha todos os campos de aparência",
            completo: aparenciaCompleta,
            href: "/acompanhante#perfil",
        },
        {
            key: "atendimento",
            label: "Defina dias de atendimento e formas de pagamento",
            completo: atendimentoCompleto,
            href: "/acompanhante#perfil",
        },
    ];

    const completos = itens.filter((i) => i.completo).length;
    const total = itens.length;
    const percentual = Math.round((completos / total) * 100);

    // Ordena: faltantes no topo (pra UI mostrar "o que falta"
    // primeiro), cumpridos no final.
    const itensOrdenados = [
        ...itens.filter((i) => !i.completo),
        ...itens.filter((i) => i.completo),
    ];

    return {
        percentual,
        completos,
        total,
        itens: itensOrdenados,
    };
}
