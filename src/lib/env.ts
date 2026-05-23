/**
 * Environment variable validation for Privello.
 *
 * - `ENV_SCHEMA` declara todas as variáveis exigidas pela aplicação em runtime.
 * - `ENV_KEYS` é o conjunto exato de chaves consumidas (usado por testes de
 *   paridade com `.env.example` e pelo script `scripts/check-env.js`).
 * - `validateEnv()` deve ser chamado na inicialização, antes de aceitar
 *   requisições HTTP. Falha coleta TODOS os erros e lança uma única `Error`
 *   nomeando cada variável ausente ou inválida.
 *
 * Requirements: 7.3, 7.5, 7.7, 7.8.
 */
import { z } from "zod";

/**
 * Conjunto canônico de variáveis de ambiente lidas pela aplicação.
 *
 * Mantenha em sincronia com `.env.example` e com `scripts/check-env.js`.
 */
export const ENV_KEYS = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "PORT",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_BASE_URL",
    "MP_ACCESS_TOKEN",
    "MP_ENVIRONMENT",
    "IBGE_BASE_URL",
    "IBGE_CACHE_TTL_HOURS",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

const nonEmpty = (label: string) =>
    z
        .string({ required_error: `${label} é obrigatório` })
        .min(1, `${label} não pode ser vazio`);

const portSchema = z
    .string({ required_error: "PORT é obrigatório" })
    .min(1, "PORT não pode ser vazio")
    .refine(
        (value) => {
            const parsed = Number.parseInt(value, 10);
            return (
                Number.isInteger(parsed) &&
                String(parsed) === value.trim() &&
                parsed >= 1 &&
                parsed <= 65535
            );
        },
        { message: "PORT deve ser um inteiro entre 1 e 65535" },
    );

const ttlHoursSchema = z
    .string({ required_error: "IBGE_CACHE_TTL_HOURS é obrigatório" })
    .min(1, "IBGE_CACHE_TTL_HOURS não pode ser vazio")
    .refine(
        (value) => {
            const parsed = Number.parseInt(value, 10);
            return (
                Number.isInteger(parsed) &&
                String(parsed) === value.trim() &&
                parsed >= 24 &&
                parsed <= 168
            );
        },
        {
            message:
                "IBGE_CACHE_TTL_HOURS deve ser um inteiro entre 24 e 168 horas",
        },
    );

const mpEnvironmentSchema = z
    .string({ required_error: "MP_ENVIRONMENT é obrigatório" })
    .min(1, "MP_ENVIRONMENT não pode ser vazio")
    .refine((value) => value === "sandbox" || value === "production", {
        message: 'MP_ENVIRONMENT deve ser "sandbox" ou "production"',
    });

const urlSchema = (label: string) =>
    z
        .string({ required_error: `${label} é obrigatório` })
        .min(1, `${label} não pode ser vazio`)
        .refine(
            (value) => {
                try {
                    const parsed = new URL(value);
                    return parsed.protocol === "http:" || parsed.protocol === "https:";
                } catch {
                    return false;
                }
            },
            { message: `${label} deve ser uma URL HTTP(S) válida` },
        );

const databaseUrlSchema = z
    .string({ required_error: "DATABASE_URL é obrigatório" })
    .min(1, "DATABASE_URL não pode ser vazio")
    .refine((value) => /^postgres(ql)?:\/\//.test(value), {
        message:
            "DATABASE_URL deve começar com postgresql:// ou postgres://",
    });

/**
 * Schema Zod listando todas as variáveis de ambiente da Privello.
 *
 * Os campos abaixo correspondem 1:1 a `ENV_KEYS`.
 */
export const ENV_SCHEMA = z.object({
    DATABASE_URL: databaseUrlSchema,
    SESSION_SECRET: nonEmpty("SESSION_SECRET").min(
        16,
        "SESSION_SECRET deve ter pelo menos 16 caracteres",
    ),
    PORT: portSchema,

    R2_ACCOUNT_ID: nonEmpty("R2_ACCOUNT_ID"),
    R2_ACCESS_KEY_ID: nonEmpty("R2_ACCESS_KEY_ID"),
    R2_SECRET_ACCESS_KEY: nonEmpty("R2_SECRET_ACCESS_KEY"),
    R2_BUCKET: nonEmpty("R2_BUCKET"),
    R2_PUBLIC_BASE_URL: urlSchema("R2_PUBLIC_BASE_URL"),

    MP_ACCESS_TOKEN: nonEmpty("MP_ACCESS_TOKEN"),
    MP_ENVIRONMENT: mpEnvironmentSchema,

    IBGE_BASE_URL: urlSchema("IBGE_BASE_URL"),
    IBGE_CACHE_TTL_HOURS: ttlHoursSchema,
});

/** Tipo das variáveis de ambiente após validação (todas como strings cruas). */
export type Env = z.infer<typeof ENV_SCHEMA>;

/**
 * Erro lançado por `validateEnv` listando todas as variáveis ausentes ou
 * inválidas em uma única mensagem determinística.
 */
export class EnvValidationError extends Error {
    public readonly missing: readonly string[];
    public readonly invalid: readonly string[];

    constructor(missing: readonly string[], invalid: readonly string[]) {
        const lines: string[] = [
            "Variáveis de ambiente inválidas ou ausentes detectadas durante validação.",
        ];
        if (missing.length > 0) {
            lines.push(`Ausentes: ${missing.join(", ")}`);
        }
        if (invalid.length > 0) {
            lines.push(`Inválidas: ${invalid.join(", ")}`);
        }
        super(lines.join(" "));
        this.name = "EnvValidationError";
        this.missing = missing;
        this.invalid = invalid;
    }
}

/**
 * Lê `source` (default: `process.env`) e separa as chaves em ausentes
 * (string vazia ou indefinida) e presentes para a validação Zod.
 */
function classifyKeys(source: NodeJS.ProcessEnv): {
    missing: string[];
    presentInput: Record<string, string>;
} {
    const missing: string[] = [];
    const presentInput: Record<string, string> = {};
    for (const key of ENV_KEYS) {
        const raw = source[key];
        if (raw === undefined || raw === "") {
            missing.push(key);
        } else {
            presentInput[key] = raw;
        }
    }
    return { missing, presentInput };
}

/**
 * Valida `process.env` (ou um objeto fornecido) contra `ENV_SCHEMA`.
 *
 * - Coleta TODOS os erros antes de lançar (em vez de falhar no primeiro).
 * - Em sucesso, retorna o objeto tipado.
 * - Em falha, lança `EnvValidationError` com uma mensagem que nomeia cada
 *   variável ausente ou inválida.
 */
export function validateEnv(source: NodeJS.ProcessEnv = process.env): Env {
    const { missing, presentInput } = classifyKeys(source);

    const result = ENV_SCHEMA.safeParse(presentInput);

    if (result.success && missing.length === 0) {
        return result.data;
    }

    const invalidSet = new Set<string>();
    if (!result.success) {
        for (const issue of result.error.issues) {
            const key = issue.path[0];
            if (typeof key === "string" && !missing.includes(key)) {
                invalidSet.add(key);
            }
        }
    }

    // Garante ordem determinística (mesma ordem de ENV_KEYS).
    const orderedMissing = ENV_KEYS.filter((k) => missing.includes(k));
    const orderedInvalid = ENV_KEYS.filter((k) => invalidSet.has(k));

    throw new EnvValidationError(orderedMissing, orderedInvalid);
}

/**
 * Atalho idempotente: valida e cacheia o resultado para reuso no mesmo
 * processo. Útil para módulos que precisam ler env após a boot.
 */
let cached: Env | undefined;
export function getEnv(): Env {
    if (cached === undefined) {
        cached = validateEnv();
    }
    return cached;
}
