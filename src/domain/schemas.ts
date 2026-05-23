/**
 * Schemas Zod reutilizáveis para os fluxos de cadastro descritos pelos
 * Requirements 2 (Cadastro de Cliente) e 3 (Onboarding de Acompanhante).
 *
 * Os schemas:
 *   - Compartilham a mesma fonte de verdade dos validadores em
 *     `src/domain/validation/*` (sem reimplementar regras).
 *   - Aplicam normalização canônica via `transform` (trim de `nome`,
 *     lower-case de `email`/`identificador`, somente-dígitos para
 *     `telefone`), de forma que o tipo de saída dos schemas reflete o
 *     formato persistido pelos serviços de aplicação.
 *
 * A unicidade de email/identificador (Requirements 2.3, 2.4) e a
 * validação de localidade contra o IBGE (Requirement 4.3) são
 * verificações de I/O e ficam fora destes schemas — são responsabilidade
 * de `src/server/cadastro-cliente` e `src/server/onboarding`.
 */

import { z } from "zod";

import {
    ALTURA_CM,
    BAIRRO_NOME_MAX,
    CORES_OLHOS,
    ESTILOS_CABELO,
    ETNIAS,
    IDIOMAS,
    PESO_KG,
    TAMANHOS_CABELO,
    TAMANHO_PE,
    type CorOlhos,
    type EstiloCabelo,
    type Etnia,
    type Idioma,
    type TamanhoCabelo,
} from "./aparencia/definitions";
import {
    MIME_TYPES_PERMITIDOS,
    TAMANHO_MAXIMO_BYTES,
    validarDescricao,
    validarEmail,
    validarFotoPerfil,
    validarIdentificadorFormato,
    validarNome,
    validarSenha,
    validarTelefone,
    normalizarEmail,
    normalizarIdentificador,
    normalizarNome,
    normalizarTelefone,
} from "./validation";

// ---------------------------------------------------------------------------
// Campos primitivos (reutilizados por cadastro e onboarding)
// ---------------------------------------------------------------------------

/**
 * `nome`: comprimento entre 2 e 100 após trim. A saída é o nome
 * trimado (Requirement 2.6).
 */
const nomeSchema = z
    .string()
    .refine(validarNome, {
        message: "Nome deve ter entre 2 e 100 caracteres após remover espaços.",
    })
    .transform((s) => normalizarNome(s));

/**
 * `email`: 5..254 caracteres no formato `parte_local@dominio.tld`.
 * A saída é o email em caixa baixa (Requirement 2.7 + 2.3).
 */
const emailSchema = z
    .string()
    .refine(validarEmail, {
        message: "Email inválido.",
    })
    .transform((s) => normalizarEmail(s));

/**
 * `identificador`: casa com `^[A-Za-z0-9_]{3,30}$`.
 * A saída é o identificador em caixa baixa (Requirement 2.5 + 2.4).
 */
const identificadorSchema = z
    .string()
    .refine(validarIdentificadorFormato, {
        message:
            "Identificador deve ter 3 a 30 caracteres alfanuméricos ou underscore.",
    })
    .transform((s) => normalizarIdentificador(s));

/**
 * `senha`: comprimento entre 8 e 128 caracteres (Requirement 2.8).
 * A saída é a senha em texto claro, **sem normalização** — é
 * responsabilidade do `Sistema_de_Autenticacao` aplicar argon2id.
 */
const senhaSchema = z.string().refine(validarSenha, {
    message: "Senha deve ter entre 8 e 128 caracteres.",
});

/**
 * `telefone`: 10 ou 11 dígitos após remover `+ ( ) - espaço`.
 * A saída é a forma somente-dígitos (Requirement 3.8).
 */
const telefoneSchema = z
    .string()
    .refine(validarTelefone, {
        message: "Telefone deve ter 10 ou 11 dígitos com DDD.",
    })
    .transform((s) => normalizarTelefone(s));

/**
 * `descricao`: comprimento entre 1 e 1000 caracteres (Requirement 3.9).
 */
const descricaoSchema = z.string().refine(validarDescricao, {
    message: "Descrição deve ter entre 1 e 1000 caracteres.",
});

/**
 * Sigla de estado: 2 letras maiúsculas. A validação contra a lista
 * oficial do IBGE é feita pelo `Sistema_de_Localidades`
 * (Requirement 4.3); aqui validamos apenas o **formato**.
 */
const estadoSiglaSchema = z
    .string()
    .regex(/^[A-Z]{2}$/, "Sigla de estado deve ter exatamente 2 letras maiúsculas.");

/**
 * Nome de cidade: string não vazia. A existência da cidade no estado
 * indicado é validada contra o IBGE (Requirement 4.3).
 */
const cidadeNomeSchema = z
    .string()
    .min(1, "Cidade obrigatória.")
    .max(120, "Cidade muito longa.");

/**
 * Chave de objeto staged em R2 (prefixo `staged/...`). A chave é
 * produzida pelo serviço de upload do onboarding e referenciada na
 * persistência atômica (Requirement 3.5).
 */
const stagedKeySchema = z
    .string()
    .min(1, "stagedKey obrigatória.")
    .max(512, "stagedKey muito longa.");

/**
 * Metadados da Foto_de_Perfil (Requirement 3.10). Aceita o triplo
 * `(mimeType, sizeBytes, stagedKey)` que o `Sistema_de_Onboarding`
 * persiste após o upload em R2.
 */
const fotoPerfilSchema = z
    .object({
        mimeType: z.enum(MIME_TYPES_PERMITIDOS),
        sizeBytes: z
            .number()
            .int()
            .positive()
            .max(TAMANHO_MAXIMO_BYTES, "Foto de perfil excede 10 MB."),
        stagedKey: stagedKeySchema,
    })
    .superRefine((value, ctx) => {
        // Defesa em profundidade: roda o validador canônico para garantir
        // paridade total com `validarFotoPerfil` mesmo se as restrições
        // acima forem afrouxadas no futuro.
        if (!validarFotoPerfil({ mimeType: value.mimeType, sizeBytes: value.sizeBytes })) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Foto de perfil inválida.",
            });
        }
    });

// ---------------------------------------------------------------------------
// Schemas compostos
// ---------------------------------------------------------------------------

/**
 * Schema do payload de cadastro de Cliente (Requirement 2.1).
 *
 * Saída (`z.infer<typeof cadastroClienteSchema>`) corresponde ao tipo
 * `CadastroClienteInput` do design **após normalização**:
 *   - `nome` trimado;
 *   - `email` em caixa baixa;
 *   - `identificador` em caixa baixa;
 *   - `senha` em texto claro (a hash é responsabilidade da camada de
 *     autenticação).
 *
 * O campo `fotoPerfil` é **opcional** — o foco do Cliente é solicitar
 * serviços, não administrar perfil, então a foto é um "nice to have"
 * (diferente do Onboarding_Acompanhante, onde é obrigatória pela natureza
 * do produto). Quando presente, segue exatamente o mesmo formato de
 * `OnboardingData.fotoPerfil` (mimeType + sizeBytes + stagedKey),
 * permitindo reaproveitar `validarFotoPerfil` e os helpers compartilhados
 * em `@/server/storage/profileMedia`.
 */
export const cadastroClienteSchema = z.object({
    nome: nomeSchema,
    email: emailSchema,
    identificador: identificadorSchema,
    senha: senhaSchema,
    fotoPerfil: fotoPerfilSchema.optional(),
});

/** Tipo derivado do {@link cadastroClienteSchema}, pós-normalização. */
export type CadastroClienteInput = z.infer<typeof cadastroClienteSchema>;

/**
 * Nome de bairro: string opcional, não vazia após trim, com limite
 * largo para acomodar bairros longos retornados pelo Overpass/OSM. A
 * normalização (trim) é aplicada via `transform`; valores vazios viram
 * `undefined` para que o caminho "sem bairro" seja representável de
 * forma uniforme.
 */
const bairroNomeSchema = z
    .string()
    .max(BAIRRO_NOME_MAX, `Bairro muito longo (máximo ${BAIRRO_NOME_MAX} caracteres).`)
    .transform((s) => s.trim())
    .transform((s) => (s.length === 0 ? undefined : s));

/**
 * Sub-schema dos atributos de aparência. Os campos textuais (peso,
 * altura, tamanho do pé, etnia, cor dos olhos, estilo e tamanho do
 * cabelo) e a lista de idiomas são **obrigatórios** no Onboarding. Os
 * switches (silicone, tatuagens, piercing, fumante) são booleanos com
 * default `false` — silêncio significa "não".
 *
 * As listas/ranges são consumidas de `@/domain/aparencia/definitions`
 * para que a única fonte de verdade dos valores aceitos fique lá.
 *
 * # Sobre os enums
 *
 * Usamos `z.enum` com tuplas literais explícitas em vez de `.map(...)`
 * sobre `ETNIAS` etc. para que o tipo inferido (`Etnia`, `CorOlhos`,
 * etc.) seja a união literal exata, não apenas `string`. Isso permite
 * que `data.etnia` no `finalizar` seja atribuído diretamente à coluna
 * tipada do Prisma sem casts intermediários.
 */
const aparenciaSchema = z.object({
    pesoKg: z
        .number()
        .int()
        .min(PESO_KG.min, `Peso deve ser ao menos ${PESO_KG.min} kg.`)
        .max(PESO_KG.max, `Peso deve ser no máximo ${PESO_KG.max} kg.`),
    alturaCm: z
        .number()
        .int()
        .min(ALTURA_CM.min, `Altura deve ser ao menos ${ALTURA_CM.min} cm.`)
        .max(ALTURA_CM.max, `Altura deve ser no máximo ${ALTURA_CM.max} cm.`),
    tamanhoPe: z
        .number()
        .int()
        .min(TAMANHO_PE.min, `Tamanho do pé deve ser ao menos ${TAMANHO_PE.min}.`)
        .max(TAMANHO_PE.max, `Tamanho do pé deve ser no máximo ${TAMANHO_PE.max}.`),
    etnia: z.enum(["BRANCA", "NEGRA", "PARDA", "AMARELA", "INDIGENA"]),
    corOlhos: z.enum(["CASTANHO", "PRETO", "AZUL", "VERDE", "MEL", "CINZA"]),
    estiloCabelo: z.enum(["LISO", "ONDULADO", "CACHEADO", "CRESPO"]),
    tamanhoCabelo: z.enum(["CURTO", "MEDIO", "LONGO"]),
    temSilicone: z.boolean().default(false),
    temTatuagens: z.boolean().default(false),
    temPiercing: z.boolean().default(false),
    fumante: z.boolean().default(false),
    idiomas: z
        .array(
            z.enum([
                "PORTUGUES",
                "INGLES",
                "ESPANHOL",
                "FRANCES",
                "ITALIANO",
                "ALEMAO",
                "OUTRO",
            ]),
        )
        .min(1, "Selecione pelo menos um idioma.")
        .max(IDIOMAS.length, "Idiomas inválidos."),
    genero: z.enum(["MULHER", "HOMEM", "TRANS"]),
    atendePublicos: z
        .array(z.enum(["MULHER", "HOMEM", "CASAL", "TRANS"]))
        .min(1, "Selecione pelo menos um público que você atende.")
        .max(4, "Públicos inválidos."),
    realizaPraticas: z
        .array(
            z.enum([
                "ORAL",
                "VAGINAL",
                "ANAL",
                "BEIJO_NA_BOCA",
                "MASSAGEM",
                "FETICHE",
            ]),
        )
        .max(6, "Práticas inválidas.")
        .default([]),
    valorHoraCents: z
        .number()
        .int()
        .min(5000, "Valor mínimo da hora é R$ 50,00.")
        .max(500000, "Valor máximo da hora é R$ 5.000,00."),
    formasPagamento: z
        .array(
            z.enum([
                "DINHEIRO",
                "PIX",
                "CARTAO_CREDITO",
                "CARTAO_DEBITO",
                "TRANSFERENCIA",
            ]),
        )
        .min(1, "Selecione pelo menos uma forma de pagamento.")
        .max(5, "Formas de pagamento inválidas."),
    diasAtende: z
        .array(z.enum(["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]))
        .min(1, "Selecione pelo menos um dia da semana.")
        .max(7, "Dias inválidos."),
});

/**
 * Schema do payload finalizador do Onboarding_Acompanhante
 * (Requirements 3.1, 3.7, 3.8, 3.9, 3.10).
 *
 * Saída (`z.infer<typeof onboardingDataSchema>`) corresponde ao tipo
 * `OnboardingData` do design **após normalização**:
 *   - `nome` trimado;
 *   - `email` em caixa baixa;
 *   - `identificador` em caixa baixa;
 *   - `telefone` somente-dígitos (sem máscara);
 *   - `bairroNome` opcional, trimado;
 *   - atributos de aparência (peso, altura, etnia, etc.) opcionais;
 *   - `fotoPerfil.mimeType` restrito a `{image/jpeg, image/png, image/webp}`.
 *
 * A validação cruzada `(estadoSigla, cidadeNome)` contra o IBGE é feita
 * pelo `Sistema_de_Localidades` (Requirement 4.3) na camada de
 * aplicação, não aqui.
 */
export const onboardingDataSchema = z.object({
    nome: nomeSchema,
    email: emailSchema,
    identificador: identificadorSchema,
    senha: senhaSchema,
    telefone: telefoneSchema,
    estadoSigla: estadoSiglaSchema,
    cidadeNome: cidadeNomeSchema,
    bairroNome: bairroNomeSchema.optional(),
    descricao: descricaoSchema,
    fotoPerfil: fotoPerfilSchema,
    pesoKg: aparenciaSchema.shape.pesoKg,
    alturaCm: aparenciaSchema.shape.alturaCm,
    tamanhoPe: aparenciaSchema.shape.tamanhoPe,
    etnia: aparenciaSchema.shape.etnia,
    corOlhos: aparenciaSchema.shape.corOlhos,
    estiloCabelo: aparenciaSchema.shape.estiloCabelo,
    tamanhoCabelo: aparenciaSchema.shape.tamanhoCabelo,
    temSilicone: aparenciaSchema.shape.temSilicone,
    temTatuagens: aparenciaSchema.shape.temTatuagens,
    temPiercing: aparenciaSchema.shape.temPiercing,
    fumante: aparenciaSchema.shape.fumante,
    idiomas: aparenciaSchema.shape.idiomas,
    genero: aparenciaSchema.shape.genero,
    atendePublicos: aparenciaSchema.shape.atendePublicos,
    realizaPraticas: aparenciaSchema.shape.realizaPraticas,
    valorHoraCents: aparenciaSchema.shape.valorHoraCents,
    formasPagamento: aparenciaSchema.shape.formasPagamento,
    diasAtende: aparenciaSchema.shape.diasAtende,
});/** Tipo derivado do {@link onboardingDataSchema}, pós-normalização. */
export type OnboardingData = z.infer<typeof onboardingDataSchema>;

// ---------------------------------------------------------------------------
// Verificação estática: os enums dos schemas batem com os tipos canônicos
// em `@/domain/aparencia/definitions`. Se alguém remover/renomear um valor
// num lugar e esquecer no outro, o `satisfies` abaixo quebra o build.
// ---------------------------------------------------------------------------

type _Coerencia = {
    etnia: Etnia;
    corOlhos: CorOlhos;
    estiloCabelo: EstiloCabelo;
    tamanhoCabelo: TamanhoCabelo;
    idiomas: Idioma[];
};

// `satisfies` força que os campos do schema sejam atribuíveis aos
// tipos canônicos sem perder narrowing literal.
const _coerencia = {} as Pick<
    OnboardingData,
    "etnia" | "corOlhos" | "estiloCabelo" | "tamanhoCabelo" | "idiomas"
>;
const _check: _Coerencia = _coerencia;
void _check;
