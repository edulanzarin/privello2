/**
 * Seed de desenvolvimento — Privello.
 *
 * Cria um conjunto rico de Acompanhantes, Clientes e interações
 * (likes, comentários, perguntas, avaliações) pra permitir teste
 * realista da home, busca, perfil público, painéis, gating de
 * Fan/Premium e Stories.
 *
 * Dados criados:
 *
 *   - **22 Acompanhantes** distribuídas em 8 cidades brasileiras,
 *     com **11 perfis em Blumenau-SC** (cidade-piloto pra teste
 *     da busca):
 *     - Variedade total de gênero (MULHER/HOMEM/TRANS), etnia,
 *       cor de olhos, estilo de cabelo, idiomas.
 *     - Faixas de preço de R$ 150 a R$ 1.000 por hora.
 *     - Mistura de Boost ativo, Premium puro e Básico.
 *     - 1 perfil oculto (`perfilVisivel=false`) pra testar HIDDEN.
 *     - 1 a 4 fotos na galeria (algumas).
 *     - Stories ativos pras Premium e algumas Básico.
 *     - Áudio de apresentação em ~5 perfis Premium.
 *     - viewsCount distribuído (boost > premium > básico).
 *   - **8 Clientes** (4 Fan + 4 Grátis), com nome e foto.
 *   - **Avaliações** (apenas texto) e **Perguntas** (algumas
 *     respondidas) cruzadas entre Clientes e Acompanhantes.
 *   - **Likes** reais em mídias (via `MediaLike`) — trigger SQL
 *     atualiza `likes_count` automaticamente.
 *   - **Visualizações** somadas (`viewsCount` direto).
 *
 * Idempotente: re-rodar regrava `passwordHash` e re-confirma
 * atributos. Linhas pré-existentes não são duplicadas.
 *
 * Senha padrão: `Edz#7284` (todos os usuários).
 *
 * Como executar:
 *   $ npx prisma db seed
 *
 * Ou diretamente:
 *   $ npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

import { hashPassword } from "../src/domain/auth/password";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Edz#7284";

const STORAGE_ROOT = path.resolve(process.cwd(), ".storage");

// Helpers
function rand<T>(arr: ReadonlyArray<T>): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: ReadonlyArray<T>): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
}

/**
 * Baixa uma imagem do picsum (placeholder) e salva em
 * `.storage/<key>`. Retorna o `storageKey` relativo.
 *
 * Idempotente: se o arquivo já existe, retorna a chave sem baixar.
 */
async function downloadImage(
    seed: string,
    width: number,
    height: number,
    key: string,
): Promise<{ storageKey: string; sizeBytes: number }> {
    const fullPath = path.join(STORAGE_ROOT, ...key.split("/"));
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        return { storageKey: key, sizeBytes: stats.size };
    }

    const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
        throw new Error(`Falha ao baixar ${url}: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);
    return { storageKey: key, sizeBytes: buffer.byteLength };
}

// -------------------------------------------------------------------
// Vocabulário (subset dos enums do schema)
// -------------------------------------------------------------------

const ETNIAS = ["BRANCA", "NEGRA", "PARDA", "AMARELA", "INDIGENA"] as const;
const COR_OLHOS = ["CASTANHO", "PRETO", "AZUL", "VERDE", "MEL", "CINZA"] as const;
const ESTILO_CABELO = ["LISO", "ONDULADO", "CACHEADO", "CRESPO"] as const;
const TAMANHO_CABELO = ["CURTO", "MEDIO", "LONGO"] as const;
const IDIOMAS = [
    "PORTUGUES",
    "INGLES",
    "ESPANHOL",
    "ITALIANO",
    "ALEMAO",
] as const;
const PRATICAS_BASE = ["ORAL", "VAGINAL", "BEIJO_NA_BOCA", "MASSAGEM"] as const;
const PRATICAS_EXTRA = ["ANAL", "FETICHE"] as const;
const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const PAGAMENTOS = ["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO"] as const;

// -------------------------------------------------------------------
// Acompanhantes — 22 perfis (11 em Blumenau-SC + 11 espalhados)
// -------------------------------------------------------------------

interface AcompanhanteSeed {
    nome: string;
    identificador: string;
    email: string;
    telefone: string;
    estadoSigla: string;
    cidadeNome: string;
    bairroNome: string;
    descricao: string;
    genero: "MULHER" | "HOMEM" | "TRANS";
    atendePublicos: ReadonlyArray<"MULHER" | "HOMEM" | "CASAL" | "TRANS">;
    pesoKg: number;
    alturaCm: number;
    tamanhoPe: number;
    etnia: (typeof ETNIAS)[number];
    corOlhos: (typeof COR_OLHOS)[number];
    estiloCabelo: (typeof ESTILO_CABELO)[number];
    tamanhoCabelo: (typeof TAMANHO_CABELO)[number];
    valorHoraCents: number;
    plano: "BASICO" | "PREMIUM";
    boost: boolean;
    perfilVisivel: boolean;
    audioApresentacao: boolean;
    publicaStories: boolean;
    publicaGaleria: number; // quantas fotos
}

const ACOMPANHANTES: ReadonlyArray<AcompanhanteSeed> = [
    {
        nome: "Júlia Santos",
        identificador: "juliasantos",
        email: "juliasantos@gmail.com",
        telefone: "11987654321",
        estadoSigla: "SP",
        cidadeNome: "São Paulo",
        bairroNome: "Moema",
        descricao:
            "Olá! Sou a Julia, atendo na zona sul de São Paulo. Buscando momentos discretos e prazerosos. Combine pelo WhatsApp.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL"],
        pesoKg: 61,
        alturaCm: 166,
        tamanhoPe: 36,
        etnia: "BRANCA",
        corOlhos: "PRETO",
        estiloCabelo: "LISO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 30_000,
        plano: "PREMIUM",
        boost: true,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: true,
        publicaGaleria: 3,
    },
    {
        nome: "Mel Maia",
        identificador: "melmaia",
        email: "melmaia@gmail.com",
        telefone: "47988123456",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Água Verde",
        descricao:
            "Atriz novinha, gostosa, rabo grande, rebolo gostoso. Atendimentos exclusivos com hora marcada.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 55,
        alturaCm: 162,
        tamanhoPe: 35,
        etnia: "BRANCA",
        corOlhos: "CASTANHO",
        estiloCabelo: "ONDULADO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 50_000,
        plano: "PREMIUM",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: true,
        publicaStories: true,
        publicaGaleria: 2,
    },
    // ─── Bloco BLUMENAU-SC ────────────────────────────────────
    // Cidade-piloto pra testar a busca: 10 perfis adicionais em
    // Blumenau cobrindo todas as variações de filtro (gênero,
    // etnia, cor de olhos, cabelo, idiomas, faixas de preço,
    // dias de atendimento, formas de pagamento e práticas).
    // ──────────────────────────────────────────────────────────
    {
        nome: "Helena Schmidt",
        identificador: "helenaschmidt",
        email: "helenaschmidt@gmail.com",
        telefone: "47988111001",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Vila Nova",
        descricao:
            "Loiríssima de olhos azuis, descendência alemã. Atendimento exclusivo, ambiente discreto e climatizado. Disponível durante a semana.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL"],
        pesoKg: 58,
        alturaCm: 168,
        tamanhoPe: 37,
        etnia: "BRANCA",
        corOlhos: "AZUL",
        estiloCabelo: "LISO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 60_000,
        plano: "PREMIUM",
        boost: true,
        perfilVisivel: true,
        audioApresentacao: true,
        publicaStories: true,
        publicaGaleria: 4,
    },
    {
        nome: "Bruna Krause",
        identificador: "brunakrause",
        email: "brunakrause@gmail.com",
        telefone: "47988111002",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Garcia",
        descricao:
            "Universitária, cabelo cacheado, sorriso fácil. Encontros descontraídos, papo longo. Atendo só em local meu.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 54,
        alturaCm: 163,
        tamanhoPe: 36,
        etnia: "PARDA",
        corOlhos: "MEL",
        estiloCabelo: "CACHEADO",
        tamanhoCabelo: "MEDIO",
        valorHoraCents: 22_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 2,
    },
    {
        nome: "Yasmin Ribeiro",
        identificador: "yasminribeiro",
        email: "yasminribeiro@gmail.com",
        telefone: "47988111003",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Velha",
        descricao:
            "Negra, alta, escultural. Atendimento profissional com agenda apertada — combine com antecedência. Aceito hotéis na região central.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL"],
        pesoKg: 64,
        alturaCm: 175,
        tamanhoPe: 39,
        etnia: "NEGRA",
        corOlhos: "PRETO",
        estiloCabelo: "CRESPO",
        tamanhoCabelo: "MEDIO",
        valorHoraCents: 70_000,
        plano: "PREMIUM",
        boost: true,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: true,
        publicaGaleria: 3,
    },
    {
        nome: "Camila Hoffmann",
        identificador: "camilahoffmann",
        email: "camilahoffmann@gmail.com",
        telefone: "47988111004",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Itoupava",
        descricao:
            "Madura, experiente, sem pressa. Café antes do encontro? Conversa boa e ambiente aconchegante.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL", "MULHER"],
        pesoKg: 67,
        alturaCm: 165,
        tamanhoPe: 36,
        etnia: "BRANCA",
        corOlhos: "VERDE",
        estiloCabelo: "ONDULADO",
        tamanhoCabelo: "MEDIO",
        valorHoraCents: 45_000,
        plano: "PREMIUM",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: true,
        publicaStories: false,
        publicaGaleria: 3,
    },
    {
        nome: "Larissa Wagner",
        identificador: "larissawagner",
        email: "larissawagner@gmail.com",
        telefone: "47988111005",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Ponta Aguda",
        descricao:
            "Ruiva natural, baixinha e cheia de energia. Atendo finais de semana e segundas. Valor justo, ambiente limpo.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 50,
        alturaCm: 156,
        tamanhoPe: 34,
        etnia: "BRANCA",
        corOlhos: "VERDE",
        estiloCabelo: "ONDULADO",
        tamanhoCabelo: "CURTO",
        valorHoraCents: 18_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: true,
        publicaGaleria: 2,
    },
    {
        nome: "Júlia Becker",
        identificador: "juliabecker",
        email: "juliabecker@gmail.com",
        telefone: "47988111006",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Centro",
        descricao:
            "Acompanhante de luxo, atendimentos longos e jantares. Falo inglês fluente e espanhol básico. Disponível para viagens.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 60,
        alturaCm: 172,
        tamanhoPe: 38,
        etnia: "BRANCA",
        corOlhos: "CASTANHO",
        estiloCabelo: "LISO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 100_000,
        plano: "PREMIUM",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: true,
        publicaStories: false,
        publicaGaleria: 4,
    },
    {
        nome: "Tainá Müller",
        identificador: "tainamuller",
        email: "tainamuller@gmail.com",
        telefone: "47988111007",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Velha Central",
        descricao:
            "Trans novinha, peituda, cheia de atitude. Encontros sem julgamento, vibe leve. Atendo durante o dia e à noite.",
        genero: "TRANS",
        atendePublicos: ["HOMEM", "CASAL"],
        pesoKg: 62,
        alturaCm: 170,
        tamanhoPe: 38,
        etnia: "PARDA",
        corOlhos: "CASTANHO",
        estiloCabelo: "LISO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 35_000,
        plano: "BASICO",
        boost: true,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: true,
        publicaGaleria: 2,
    },
    {
        nome: "Diego Lima",
        identificador: "diegoolima",
        email: "diegoolima@gmail.com",
        telefone: "47988111008",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Vila Itoupava",
        descricao:
            "Garoto de programa, malhado, discreto. Atendo homens, mulheres e casais. Ambiente seguro com hora marcada.",
        genero: "HOMEM",
        atendePublicos: ["HOMEM", "MULHER", "CASAL"],
        pesoKg: 82,
        alturaCm: 182,
        tamanhoPe: 42,
        etnia: "PARDA",
        corOlhos: "CASTANHO",
        estiloCabelo: "ONDULADO",
        tamanhoCabelo: "CURTO",
        valorHoraCents: 30_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 2,
    },
    {
        nome: "Sabrina Costa",
        identificador: "sabrinacosta",
        email: "sabrinacosta@gmail.com",
        telefone: "47988111009",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Salto Weissbach",
        descricao:
            "Massagista profissional, atendimento sensual e relaxante. Especialidade em casais. Sem pressa, sem julgamento.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL", "MULHER"],
        pesoKg: 59,
        alturaCm: 166,
        tamanhoPe: 36,
        etnia: "AMARELA",
        corOlhos: "PRETO",
        estiloCabelo: "LISO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 40_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: true,
        publicaGaleria: 3,
    },
    {
        nome: "Rafaela Klein",
        identificador: "rafaklein",
        email: "rafaklein@gmail.com",
        telefone: "47988111010",
        estadoSigla: "SC",
        cidadeNome: "Blumenau",
        bairroNome: "Itoupavazinha",
        descricao:
            "Casual e direta. Encontros rápidos sem complicação, valor acessível. Aceito pix e dinheiro.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 63,
        alturaCm: 161,
        tamanhoPe: 35,
        etnia: "BRANCA",
        corOlhos: "AZUL",
        estiloCabelo: "LISO",
        tamanhoCabelo: "MEDIO",
        valorHoraCents: 15_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 1,
    },
    {
        nome: "Bianca Andrade",
        identificador: "biancaa",
        email: "biancaa@gmail.com",
        telefone: "21988774455",
        estadoSigla: "RJ",
        cidadeNome: "Rio de Janeiro",
        bairroNome: "Copacabana",
        descricao:
            "Carioca, alegre e cheia de energia. Adoro encontros leves e bem-humorados. Atendo em local próprio.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL", "MULHER"],
        pesoKg: 58,
        alturaCm: 168,
        tamanhoPe: 37,
        etnia: "PARDA",
        corOlhos: "MEL",
        estiloCabelo: "CACHEADO",
        tamanhoCabelo: "MEDIO",
        valorHoraCents: 40_000,
        plano: "PREMIUM",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: true,
        publicaGaleria: 3,
    },
    {
        nome: "Ana Clara",
        identificador: "anaclara",
        email: "anaclara@gmail.com",
        telefone: "31999887766",
        estadoSigla: "MG",
        cidadeNome: "Belo Horizonte",
        bairroNome: "Savassi",
        descricao:
            "Mineira meiga e carinhosa. Atendimento exclusivo, com atenção e tempo de qualidade.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 53,
        alturaCm: 160,
        tamanhoPe: 35,
        etnia: "BRANCA",
        corOlhos: "VERDE",
        estiloCabelo: "LISO",
        tamanhoCabelo: "MEDIO",
        valorHoraCents: 25_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 2,
    },
    {
        nome: "Raissa Lima",
        identificador: "raissalima",
        email: "raissalima@gmail.com",
        telefone: "71988556677",
        estadoSigla: "BA",
        cidadeNome: "Salvador",
        bairroNome: "Barra",
        descricao:
            "Baiana ardente. Sensual, divertida e sempre disposta. Vem comigo curtir Salvador.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL"],
        pesoKg: 65,
        alturaCm: 170,
        tamanhoPe: 38,
        etnia: "NEGRA",
        corOlhos: "PRETO",
        estiloCabelo: "CRESPO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 35_000,
        plano: "BASICO",
        boost: true,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 2,
    },
    {
        nome: "Larissa Oliveira",
        identificador: "larissaoli",
        email: "larissaoli@gmail.com",
        telefone: "41987654321",
        estadoSigla: "PR",
        cidadeNome: "Curitiba",
        bairroNome: "Batel",
        descricao:
            "Paranaense elegante. Procuro encontros com pessoas educadas e respeitosas.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 56,
        alturaCm: 165,
        tamanhoPe: 36,
        etnia: "BRANCA",
        corOlhos: "AZUL",
        estiloCabelo: "LISO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 28_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 1,
    },
    {
        nome: "Camila Reis",
        identificador: "camilareis",
        email: "camilareis@gmail.com",
        telefone: "51988998877",
        estadoSigla: "RS",
        cidadeNome: "Porto Alegre",
        bairroNome: "Moinhos de Vento",
        descricao:
            "Gaúcha de pele clara, olhos claros, sorriso fácil. Atendo durante a semana, agenda flexível.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 58,
        alturaCm: 167,
        tamanhoPe: 37,
        etnia: "BRANCA",
        corOlhos: "VERDE",
        estiloCabelo: "ONDULADO",
        tamanhoCabelo: "MEDIO",
        valorHoraCents: 32_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 2,
    },
    {
        nome: "Sophia Martins",
        identificador: "sophiamartins",
        email: "sophiamartins@gmail.com",
        telefone: "81988776655",
        estadoSigla: "PE",
        cidadeNome: "Recife",
        bairroNome: "Boa Viagem",
        descricao:
            "Trans, charmosa e segura de mim. Atendo com discrição e disposição para conversar.",
        genero: "TRANS",
        atendePublicos: ["HOMEM", "CASAL"],
        pesoKg: 70,
        alturaCm: 175,
        tamanhoPe: 39,
        etnia: "PARDA",
        corOlhos: "CASTANHO",
        estiloCabelo: "LISO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 45_000,
        plano: "PREMIUM",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: true,
        publicaGaleria: 3,
    },
    {
        nome: "Beatriz Souza",
        identificador: "biasz",
        email: "biasz@gmail.com",
        telefone: "85988445566",
        estadoSigla: "CE",
        cidadeNome: "Fortaleza",
        bairroNome: "Aldeota",
        descricao:
            "Cearense gostosa e cheia de gingado. Atendimento à noite e finais de semana.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL"],
        pesoKg: 60,
        alturaCm: 169,
        tamanhoPe: 37,
        etnia: "PARDA",
        corOlhos: "CASTANHO",
        estiloCabelo: "ONDULADO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 22_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 1,
    },
    {
        nome: "Letícia Almeida",
        identificador: "leticiaa",
        email: "leticiaa@gmail.com",
        telefone: "61988220011",
        estadoSigla: "DF",
        cidadeNome: "Brasília",
        bairroNome: "Asa Sul",
        descricao:
            "Brasiliense formada e independente. Atendimento sério, bom papo, ambiente discreto.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 57,
        alturaCm: 164,
        tamanhoPe: 36,
        etnia: "BRANCA",
        corOlhos: "CASTANHO",
        estiloCabelo: "LISO",
        tamanhoCabelo: "MEDIO",
        valorHoraCents: 80_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 0,
    },
    {
        nome: "Carolina Ferreira",
        identificador: "caroferreira",
        email: "caroferreira@gmail.com",
        telefone: "11999332211",
        estadoSigla: "SP",
        cidadeNome: "São Paulo",
        bairroNome: "Itaim Bibi",
        descricao:
            "Loira, sofisticada, atendimentos premium em hotéis e residências. Apenas para clientes selecionados.",
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        pesoKg: 59,
        alturaCm: 172,
        tamanhoPe: 37,
        etnia: "BRANCA",
        corOlhos: "AZUL",
        estiloCabelo: "LISO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 60_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: false, // perfil oculto pra testar HIDDEN
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 0,
    },
    {
        nome: "Mariana Costa",
        identificador: "maricosta",
        email: "maricosta@gmail.com",
        telefone: "21988224477",
        estadoSigla: "RJ",
        cidadeNome: "Rio de Janeiro",
        bairroNome: "Ipanema",
        descricao:
            "Praiana de coração. Adoro receber visitantes da cidade e mostrar o melhor do Rio.",
        genero: "MULHER",
        atendePublicos: ["HOMEM", "CASAL", "MULHER"],
        pesoKg: 60,
        alturaCm: 167,
        tamanhoPe: 36,
        etnia: "PARDA",
        corOlhos: "MEL",
        estiloCabelo: "ONDULADO",
        tamanhoCabelo: "LONGO",
        valorHoraCents: 35_000,
        plano: "BASICO",
        boost: false,
        perfilVisivel: true,
        audioApresentacao: false,
        publicaStories: false,
        publicaGaleria: 2,
    },
];

// -------------------------------------------------------------------
// Clientes — 8 contas
// -------------------------------------------------------------------

interface ClienteSeed {
    nome: string;
    identificador: string;
    email: string;
    plano: "GRATIS" | "FAN";
}

const CLIENTES: ReadonlyArray<ClienteSeed> = [
    { nome: "Pedro Henrique", identificador: "pedrohh", email: "pedrohh@gmail.com", plano: "FAN" },
    { nome: "Rafael Silva", identificador: "rafasilva", email: "rafasilva@gmail.com", plano: "FAN" },
    { nome: "Lucas Andrade", identificador: "lucasandrade", email: "lucasandrade@gmail.com", plano: "FAN" },
    { nome: "Bruno Tavares", identificador: "brunot", email: "brunot@gmail.com", plano: "FAN" },
    { nome: "Marcos Vieira", identificador: "marcosvieira", email: "marcosvieira@gmail.com", plano: "GRATIS" },
    { nome: "Diego Ramos", identificador: "diegoramos", email: "diegoramos@gmail.com", plano: "GRATIS" },
    { nome: "Felipe Cardoso", identificador: "felipec", email: "felipec@gmail.com", plano: "GRATIS" },
    { nome: "Igor Mendes", identificador: "igormendes", email: "igormendes@gmail.com", plano: "GRATIS" },
];

// -------------------------------------------------------------------
// Conteúdo aleatório
// -------------------------------------------------------------------

const REVIEWS_TEMPLATES = [
    "Atendimento excelente, super recomendo. Pessoa atenciosa e cuidadosa do começo ao fim.",
    "Encontro muito bom, ambiente discreto e tranquilo. Voltarei com certeza.",
    "Conversa boa, energia ótima. Vale cada minuto.",
    "Profissional dedicada, muito carinhosa. Foi um momento especial.",
    "Pessoa linda, simpática e educada. Recomendo demais.",
    "Achei tudo dentro do combinado. Honesta e gentil.",
    "Encontro inesquecível. Vou marcar de novo logo.",
    "Pontual, simpática e sabe receber. Atendimento de primeira.",
    "Atende com classe, ambiente caprichado. Recomendado.",
    "Ótimo papo, ótimo atendimento. Saí satisfeito.",
];

const QUESTIONS_TEMPLATES = [
    "Atende durante a semana à noite?",
    "Vai a hotel?",
    "Aceita cartão de crédito mesmo?",
    "Quanto tempo de antecedência precisa marcar?",
    "Atende casais?",
    "Tem disponibilidade no fim de semana?",
    "Quanto cobra por duas horas?",
    "Pode atender em local meu?",
    "Atende de manhã também?",
    "Aceita pix antes do encontro?",
];

const ANSWERS_TEMPLATES = [
    "Sim, atendo de segunda a sexta a partir das 19h.",
    "Sim, vou a hotéis na região central. Combine pelo WhatsApp.",
    "Aceito cartão sim, com taxa do operador.",
    "Prefiro com pelo menos 2h de antecedência.",
    "Sim, atendo casais. Valor combinado por mensagem.",
    "Atendo sábados e alguns domingos, mande mensagem.",
    "Para 2h fica R$ 500. Combinamos pelo WhatsApp.",
    "Sim, vou a residências discretas. Conversa antes.",
    "Atendo a partir das 14h.",
    "Sim, prefiro pix antes pra confirmar a reserva.",
];

const COMMENTS_TEMPLATES = [
    "Linda demais!",
    "Maravilhosa.",
    "Que gata.",
    "Apaixonado.",
    "Sensacional.",
    "Que perfil bonito.",
    "Top.",
    "Diva.",
];

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main(): Promise<void> {
    const passwordHash = await hashPassword(SEED_PASSWORD);
    const now = new Date();

    // 1) Limpa interações pra rodar idempotente sem duplicar
    //    likes/comments/reviews/questions. Mantém users e profiles.
    console.log("→ Limpando interações antigas…");
    await prisma.mediaLike.deleteMany();
    await prisma.mediaComment.deleteMany();
    await prisma.acompanhanteReview.deleteMany();
    await prisma.acompanhanteQuestion.deleteMany();
    await prisma.storyView.deleteMany();
    await prisma.reelView.deleteMany();
    await prisma.boostPayment.deleteMany();
    // Apaga Media não-perfil (galeria, story, áudio, capa)
    // pra evitar acúmulo; foto de perfil é mantida via upsert.
    await prisma.media.deleteMany({
        where: { role: { in: ["GALLERY", "STORY", "AUDIO", "COVER", "REEL"] } },
    });

    // 2) Cria/atualiza Acompanhantes
    const acompanhantesIds: string[] = [];

    for (const a of ACOMPANHANTES) {
        console.log(`→ Acompanhante ${a.nome} (${a.cidadeNome}, ${a.estadoSigla})`);

        const user = await prisma.user.upsert({
            where: { email: a.email },
            update: {
                passwordHash,
                identificador: a.identificador,
                nome: a.nome,
                type: "ACOMPANHANTE",
            },
            create: {
                email: a.email,
                identificador: a.identificador,
                nome: a.nome,
                passwordHash,
                type: "ACOMPANHANTE",
            },
            select: { id: true },
        });
        acompanhantesIds.push(user.id);

        // Foto de perfil — baixa picsum
        const fotoSeed = `${a.identificador}-profile`;
        const fotoKey = `committed/${user.id}/profile/${randomUUID()}.jpg`;
        const fotoMeta = await downloadImage(fotoSeed, 600, 800, fotoKey);

        // Cria Media de foto perfil (apaga anterior se houver)
        const existingProfile = await prisma.acompanhanteProfile.findUnique({
            where: { userId: user.id },
            select: { fotoPerfilId: true },
        });
        if (existingProfile?.fotoPerfilId) {
            await prisma.media.deleteMany({
                where: { id: existingProfile.fotoPerfilId },
            });
        }

        const fotoMedia = await prisma.media.create({
            data: {
                ownerId: user.id,
                storageKey: fotoMeta.storageKey,
                mimeType: "image/jpeg",
                sizeBytes: fotoMeta.sizeBytes,
                status: "COMMITTED",
                kind: "PHOTO",
                role: "PROFILE",
                isProfilePhoto: true,
            },
            select: { id: true },
        });

        // Práticas: base + opcional extra
        const praticas = [
            ...PRATICAS_BASE,
            ...(Math.random() > 0.5 ? [rand(PRATICAS_EXTRA)] : []),
        ];
        // Idiomas: PT obrigatório + extras variados.
        // Em Blumenau, adicionamos chance de ALEMAO (cidade
        // colônia) pra ter perfis testáveis com filtro
        // `idiomas=ALEMAO`. Em outras cidades, mistura padrão.
        const idiomas: Array<
            "PORTUGUES" | "INGLES" | "ESPANHOL" | "ITALIANO" | "ALEMAO"
        > = ["PORTUGUES"];
        if (Math.random() > 0.5) idiomas.push("INGLES");
        if (Math.random() > 0.7) idiomas.push("ESPANHOL");
        if (a.cidadeNome === "Blumenau" && Math.random() > 0.5) {
            idiomas.push("ALEMAO");
        }
        if (Math.random() > 0.85) idiomas.push("ITALIANO");

        // Boost ativo: até +24h
        const boostUntil = a.boost
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
            : null;

        // Visualizações: distribuídas pra dar ordenação interessante
        const viewsCount = a.boost
            ? randInt(150, 400)
            : a.plano === "PREMIUM"
                ? randInt(50, 200)
                : randInt(5, 80);

        await prisma.acompanhanteProfile.upsert({
            where: { userId: user.id },
            update: {
                telefone: a.telefone,
                estadoSigla: a.estadoSigla,
                cidadeNome: a.cidadeNome,
                bairroNome: a.bairroNome,
                descricao: a.descricao,
                fotoPerfilId: fotoMedia.id,
                planoVigente: a.plano,
                planoSelecionadoEm: now,
                perfilVisivel: a.perfilVisivel,
                boostUntil,
                viewsCount,
                genero: a.genero,
                atendePublicos: a.atendePublicos as Array<
                    "MULHER" | "HOMEM" | "CASAL" | "TRANS"
                >,
                realizaPraticas: praticas as Array<
                    | "ORAL"
                    | "VAGINAL"
                    | "ANAL"
                    | "BEIJO_NA_BOCA"
                    | "MASSAGEM"
                    | "FETICHE"
                >,
                pesoKg: a.pesoKg,
                alturaCm: a.alturaCm,
                tamanhoPe: a.tamanhoPe,
                etnia: a.etnia,
                corOlhos: a.corOlhos,
                estiloCabelo: a.estiloCabelo,
                tamanhoCabelo: a.tamanhoCabelo,
                temSilicone: Math.random() > 0.7,
                temTatuagens: Math.random() > 0.5,
                temPiercing: Math.random() > 0.6,
                fumante: Math.random() > 0.85,
                idiomas,
                valorHoraCents: a.valorHoraCents,
                formasPagamento: shuffle(PAGAMENTOS).slice(
                    0,
                    randInt(2, 4),
                ) as Array<
                    | "DINHEIRO"
                    | "PIX"
                    | "CARTAO_CREDITO"
                    | "CARTAO_DEBITO"
                    | "TRANSFERENCIA"
                >,
                diasAtende: shuffle(DIAS).slice(0, randInt(4, 7)) as Array<
                    "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB" | "DOM"
                >,
            },
            create: {
                userId: user.id,
                telefone: a.telefone,
                estadoSigla: a.estadoSigla,
                cidadeNome: a.cidadeNome,
                bairroNome: a.bairroNome,
                descricao: a.descricao,
                fotoPerfilId: fotoMedia.id,
                planoVigente: a.plano,
                planoSelecionadoEm: now,
                perfilVisivel: a.perfilVisivel,
                boostUntil,
                viewsCount,
                genero: a.genero,
                atendePublicos: a.atendePublicos as Array<
                    "MULHER" | "HOMEM" | "CASAL" | "TRANS"
                >,
                realizaPraticas: praticas as Array<
                    | "ORAL"
                    | "VAGINAL"
                    | "ANAL"
                    | "BEIJO_NA_BOCA"
                    | "MASSAGEM"
                    | "FETICHE"
                >,
                pesoKg: a.pesoKg,
                alturaCm: a.alturaCm,
                tamanhoPe: a.tamanhoPe,
                etnia: a.etnia,
                corOlhos: a.corOlhos,
                estiloCabelo: a.estiloCabelo,
                tamanhoCabelo: a.tamanhoCabelo,
                temSilicone: Math.random() > 0.7,
                temTatuagens: Math.random() > 0.5,
                temPiercing: Math.random() > 0.6,
                fumante: Math.random() > 0.85,
                idiomas,
                valorHoraCents: a.valorHoraCents,
                formasPagamento: shuffle(PAGAMENTOS).slice(
                    0,
                    randInt(2, 4),
                ) as Array<
                    | "DINHEIRO"
                    | "PIX"
                    | "CARTAO_CREDITO"
                    | "CARTAO_DEBITO"
                    | "TRANSFERENCIA"
                >,
                diasAtende: shuffle(DIAS).slice(0, randInt(4, 7)) as Array<
                    "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB" | "DOM"
                >,
            },
        });

        // Galeria
        for (let i = 0; i < a.publicaGaleria; i++) {
            const galeriaSeed = `${a.identificador}-gal-${i}`;
            const galeriaKey = `committed/${user.id}/galeria/${randomUUID()}.jpg`;
            const galeriaMeta = await downloadImage(
                galeriaSeed,
                600,
                800,
                galeriaKey,
            );
            await prisma.media.create({
                data: {
                    ownerId: user.id,
                    storageKey: galeriaMeta.storageKey,
                    mimeType: "image/jpeg",
                    sizeBytes: galeriaMeta.sizeBytes,
                    status: "COMMITTED",
                    kind: "PHOTO",
                    role: "GALLERY",
                    description: rand([
                        "Tarde de domingo.",
                        "Bom dia.",
                        "Vibe de verão.",
                        null,
                        null,
                        "Pronta pra te receber.",
                    ]),
                },
            });
        }

        // Stories ativos (premium com publicaStories)
        if (a.publicaStories) {
            const numStories = randInt(1, 3);
            for (let i = 0; i < numStories; i++) {
                const storySeed = `${a.identificador}-story-${i}`;
                const storyKey = `committed/${user.id}/stories/${randomUUID()}.jpg`;
                const storyMeta = await downloadImage(
                    storySeed,
                    600,
                    900,
                    storyKey,
                );
                await prisma.media.create({
                    data: {
                        ownerId: user.id,
                        storageKey: storyMeta.storageKey,
                        mimeType: "image/jpeg",
                        sizeBytes: storyMeta.sizeBytes,
                        status: "COMMITTED",
                        kind: "PHOTO",
                        role: "STORY",
                        expiresAt: new Date(
                            now.getTime() + 24 * 60 * 60 * 1000,
                        ),
                        description: i === 0
                            ? rand([
                                "Bom dia ☀️",
                                "Hoje é dia",
                                "Vamos?",
                                null,
                            ])
                            : null,
                    },
                });
            }
        }

        // Reels — vídeos curtos. Todas as Acompanhantes podem
        // publicar (Básico até 20, Premium ilimitado). No seed
        // usamos imagens como placeholder (o player aceita
        // qualquer MIME; em produção serão vídeos reais). Cada
        // Acompanhante publica 1-3 Reels com duração simulada.
        const numReels = randInt(1, 3);
        for (let i = 0; i < numReels; i++) {
            const reelSeed = `${a.identificador}-reel-${i}`;
            const reelKey = `committed/${user.id}/reels/${randomUUID()}.mp4`;
            const reelMeta = await downloadImage(
                reelSeed,
                720,
                1280,
                reelKey,
            );
            await prisma.media.create({
                data: {
                    ownerId: user.id,
                    storageKey: reelMeta.storageKey,
                    mimeType: "video/mp4",
                    sizeBytes: reelMeta.sizeBytes,
                    status: "COMMITTED",
                    kind: "VIDEO",
                    role: "REEL",
                    durationSeconds: randInt(10, 60),
                    description: rand([
                        "Vem comigo 🔥",
                        "Disponível hoje",
                        "Novidade da semana",
                        null,
                        null,
                    ]),
                },
            });
        }
    }

    // 3) Cria/atualiza Clientes
    const clientesIds: { id: string; plano: "GRATIS" | "FAN" }[] = [];

    for (const c of CLIENTES) {
        console.log(`→ Cliente ${c.nome} (${c.plano})`);

        const user = await prisma.user.upsert({
            where: { email: c.email },
            update: {
                passwordHash,
                identificador: c.identificador,
                nome: c.nome,
                type: "CLIENTE",
            },
            create: {
                email: c.email,
                identificador: c.identificador,
                nome: c.nome,
                passwordHash,
                type: "CLIENTE",
            },
            select: { id: true },
        });
        clientesIds.push({ id: user.id, plano: c.plano });

        // Foto de perfil
        const fotoSeed = `${c.identificador}-profile`;
        const fotoKey = `committed/${user.id}/profile/${randomUUID()}.jpg`;
        const fotoMeta = await downloadImage(fotoSeed, 400, 400, fotoKey);

        const existingClient = await prisma.clientProfile.findUnique({
            where: { userId: user.id },
            select: { fotoPerfilId: true },
        });
        if (existingClient?.fotoPerfilId) {
            await prisma.media.deleteMany({
                where: { id: existingClient.fotoPerfilId },
            });
        }

        const fotoMedia = await prisma.media.create({
            data: {
                ownerId: user.id,
                storageKey: fotoMeta.storageKey,
                mimeType: "image/jpeg",
                sizeBytes: fotoMeta.sizeBytes,
                status: "COMMITTED",
                kind: "PHOTO",
                role: "PROFILE",
                isProfilePhoto: true,
            },
            select: { id: true },
        });

        // Cliente Fan no seed ganha 30 dias a partir de agora —
        // simula assinatura recém-comprada. Cliente Grátis fica
        // sem expiração.
        const planoExpiraEm =
            c.plano === "FAN"
                ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
                : null;

        await prisma.clientProfile.upsert({
            where: { userId: user.id },
            update: {
                fotoPerfilId: fotoMedia.id,
                planoVigente: c.plano,
                planoSelecionadoEm: now,
                planoExpiraEm,
            },
            create: {
                userId: user.id,
                fotoPerfilId: fotoMedia.id,
                planoVigente: c.plano,
                planoSelecionadoEm: now,
                planoExpiraEm,
            },
        });
    }

    // 4) Reviews — Clientes Fan avaliam Acompanhantes aleatórias
    console.log("→ Criando avaliações…");
    const fans = clientesIds.filter((c) => c.plano === "FAN");

    for (const a of acompanhantesIds) {
        // Cada acompanhante recebe 1..4 reviews de fans aleatórios
        const numReviews = randInt(1, Math.min(4, fans.length));
        const selectedFans = shuffle(fans).slice(0, numReviews);
        for (const fan of selectedFans) {
            await prisma.acompanhanteReview.create({
                data: {
                    targetUserId: a,
                    authorUserId: fan.id,
                    comment: rand(REVIEWS_TEMPLATES),
                    createdAt: new Date(
                        now.getTime() - randInt(1, 30) * 86_400_000,
                    ),
                },
            });
        }
    }

    // 5) Questions — Clientes Fan perguntam, algumas respondidas
    console.log("→ Criando perguntas…");
    for (const a of acompanhantesIds) {
        const numQ = randInt(0, 3);
        for (let i = 0; i < numQ; i++) {
            const fan = rand(fans);
            const respondida = Math.random() > 0.4;
            const askedAt = new Date(
                now.getTime() - randInt(1, 14) * 86_400_000,
            );
            await prisma.acompanhanteQuestion.create({
                data: {
                    targetUserId: a,
                    authorUserId: fan.id,
                    question: rand(QUESTIONS_TEMPLATES),
                    answer: respondida ? rand(ANSWERS_TEMPLATES) : null,
                    answeredAt: respondida
                        ? new Date(
                            askedAt.getTime() + randInt(1, 48) * 3_600_000,
                        )
                        : null,
                    createdAt: askedAt,
                },
            });
        }
    }

    // 6) Likes em mídias da galeria — só Fans dão like
    console.log("→ Criando likes…");
    const allGalleryMedia = await prisma.media.findMany({
        where: { role: "GALLERY", status: "COMMITTED" },
        select: { id: true },
    });
    for (const media of allGalleryMedia) {
        const numLikes = randInt(0, fans.length);
        const likers = shuffle(fans).slice(0, numLikes);
        for (const fan of likers) {
            await prisma.mediaLike.create({
                data: {
                    mediaId: media.id,
                    userId: fan.id,
                    createdAt: new Date(
                        now.getTime() - randInt(1, 20) * 86_400_000,
                    ),
                },
            });
        }
    }

    // 7) Comentários em fotos da galeria
    console.log("→ Criando comentários…");
    for (const media of allGalleryMedia) {
        if (Math.random() > 0.4) continue;
        const numComments = randInt(1, 3);
        for (let i = 0; i < numComments; i++) {
            const fan = rand(fans);
            await prisma.mediaComment.create({
                data: {
                    mediaId: media.id,
                    authorUserId: fan.id,
                    text: rand(COMMENTS_TEMPLATES),
                    createdAt: new Date(
                        now.getTime() - randInt(1, 15) * 86_400_000,
                    ),
                },
            });
        }
    }

    // 8) Algumas visualizações de Stories (Fan já viu alguns)
    console.log("→ Marcando algumas visualizações de Stories…");
    const allStories = await prisma.media.findMany({
        where: { role: "STORY", status: "COMMITTED" },
        select: { id: true, ownerId: true },
    });
    for (const story of allStories) {
        // ~50% de chance de ter sido visto por cada cliente Fan
        for (const fan of fans) {
            if (fan.id === story.ownerId) continue;
            if (Math.random() > 0.5) continue;
            await prisma.storyView.create({
                data: {
                    mediaId: story.id,
                    userId: fan.id,
                    viewedAt: new Date(
                        now.getTime() - randInt(1, 12) * 3_600_000,
                    ),
                },
            });
        }
    }

    // 9) Limpa sessões e tentativas de login antigas
    console.log("→ Limpando sessões antigas…");
    await prisma.session.deleteMany();
    await prisma.loginAttempt.deleteMany();

    // 10) Resumo
    const stats = {
        acompanhantes: await prisma.acompanhanteProfile.count(),
        clientes: await prisma.clientProfile.count(),
        midiasPerfil: await prisma.media.count({ where: { role: "PROFILE" } }),
        midiasGaleria: await prisma.media.count({ where: { role: "GALLERY" } }),
        midiasStories: await prisma.media.count({ where: { role: "STORY" } }),
        midiasReels: await prisma.media.count({ where: { role: "REEL" } }),
        likes: await prisma.mediaLike.count(),
        comentarios: await prisma.mediaComment.count(),
        reviews: await prisma.acompanhanteReview.count(),
        perguntas: await prisma.acompanhanteQuestion.count(),
        perguntasRespondidas: await prisma.acompanhanteQuestion.count({
            where: { answeredAt: { not: null } },
        }),
        storyViews: await prisma.storyView.count(),
    };

    // Distribuição por cidade — facilita validar que a busca por
    // cidade tem volume suficiente pra testar filtros.
    const porCidade = await prisma.acompanhanteProfile.groupBy({
        by: ["estadoSigla", "cidadeNome"],
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
    });

    console.log("\n✓ Seed concluído.\n");
    console.log("Stats:");
    console.log(`  Acompanhantes:           ${stats.acompanhantes}`);
    console.log(`  Clientes:                ${stats.clientes}`);
    console.log(`  Mídias (perfil):         ${stats.midiasPerfil}`);
    console.log(`  Mídias (galeria):        ${stats.midiasGaleria}`);
    console.log(`  Mídias (stories):        ${stats.midiasStories}`);
    console.log(`  Mídias (reels):          ${stats.midiasReels}`);
    console.log(`  Likes:                   ${stats.likes}`);
    console.log(`  Comentários:             ${stats.comentarios}`);
    console.log(`  Avaliações:              ${stats.reviews}`);
    console.log(`  Perguntas:               ${stats.perguntas} (${stats.perguntasRespondidas} respondidas)`);
    console.log(`  Visualizações de Story:  ${stats.storyViews}`);
    console.log(`\nDistribuição por cidade:`);
    for (const c of porCidade) {
        console.log(
            `  ${c.cidadeNome}, ${c.estadoSigla}: ${c._count._all} ${c._count._all === 1 ? "perfil" : "perfis"}`,
        );
    }
    console.log(`\nSenha de todos os usuários: ${SEED_PASSWORD}`);
    console.log(`\nLogins de teste:`);
    console.log(`  Acompanhante: ${ACOMPANHANTES[0]!.email} (Premium + Boost + Stories)`);
    console.log(`  Acompanhante: ${ACOMPANHANTES[1]!.email} (Premium + Áudio · Blumenau)`);
    console.log(`  Acompanhante: helenaschmidt@gmail.com (Premium + Boost · Blumenau)`);
    console.log(`  Acompanhante: tainamuller@gmail.com (Trans · Blumenau)`);
    console.log(`  Acompanhante: diegoolima@gmail.com (Homem · Blumenau)`);
    console.log(`  Cliente Fan:  ${CLIENTES[0]!.email}`);
    console.log(`  Cliente Grátis: ${CLIENTES[4]!.email}`);
}

main()
    .catch((err) => {
        console.error("✗ Seed falhou:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
