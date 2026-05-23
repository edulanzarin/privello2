/**
 * Shared fast-check arbitraries for the Privello platform property-based tests.
 *
 * The generators encode the validation rules described in the requirements
 * (Requirements 2, 3 and 4) and the design contracts. They are intentionally
 * narrow on the "valid" side and broad on the "invalid" side so that each
 * Correctness Property test can pick whichever distribution it needs without
 * duplicating boundary logic.
 *
 * Conventions:
 *   - `valid*Arb`   produces values that satisfy the rule.
 *   - `invalid*Arb` produces values that fail the rule for at least one reason.
 *   - Composite arbitraries (`cadastroClienteInputArb`, `onboardingDataArb`)
 *     compose the leaf arbitraries above.
 */

import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Primitives — character classes
// ---------------------------------------------------------------------------

/** Visible ASCII characters that are typically allowed inside a `nome` field. */
const nameCharArb = fc.constantFrom(
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÉÊÍÓÔÕÚÇàáâãéêíóôõúç ".split(""),
);

/** Allowed identifier characters: `[A-Za-z0-9_]` (Requirement 2.5). */
const identifierCharArb = fc.constantFrom(
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_".split(""),
);

/** Local-part characters for emails (kept conservative on purpose). */
const emailLocalCharArb = fc.constantFrom(
    ..."abcdefghijklmnopqrstuvwxyz0123456789._-".split(""),
);

/** Domain label characters for emails (no leading/trailing dot or hyphen). */
const emailDomainCharArb = fc.constantFrom(
    ..."abcdefghijklmnopqrstuvwxyz0123456789-".split(""),
);

// ---------------------------------------------------------------------------
// Nome — Requirement 2.6: comprimento entre 2 e 100 após trim
// ---------------------------------------------------------------------------

/**
 * Valid `nome`: a non-empty string whose `.trim().length` is in [2, 100].
 * We build the trimmed core (length 2..100) and optionally pad with spaces
 * so we still exercise the trimming step that the validator must perform.
 */
export const validNomeArb: fc.Arbitrary<string> = fc
    .tuple(
        fc.array(nameCharArb, { minLength: 2, maxLength: 100 }),
        fc.nat({ max: 5 }),
        fc.nat({ max: 5 }),
    )
    .map(([core, leftPad, rightPad]) => {
        // Ensure first and last chars of the core are not whitespace so
        // `core.trim() === core` and we control the trimmed length precisely.
        let body = core.join("");
        if (body[0] === " ") body = "A" + body.slice(1);
        if (body[body.length - 1] === " ") body = body.slice(0, -1) + "A";
        return " ".repeat(leftPad) + body + " ".repeat(rightPad);
    })
    .filter((s) => {
        const t = s.trim();
        return t.length >= 2 && t.length <= 100;
    });

/**
 * Invalid `nome`: trims to a length outside [2, 100] (either too short, only
 * whitespace, or too long).
 */
export const invalidNomeArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant(""),
    fc.constant(" "),
    fc.constant("A"),
    fc.constant("  A  "),
    fc.array(nameCharArb, { minLength: 101, maxLength: 200 }).map((cs) => cs.join("")),
);

// ---------------------------------------------------------------------------
// Email — Requirement 2.7: total 5..254 chars, parte_local@dominio.tld
// ---------------------------------------------------------------------------

/**
 * Valid email: non-empty local part, single '@', domain with at least one dot
 * and a TLD of at least 2 letters; total length in [5, 254].
 */
export const validEmailArb: fc.Arbitrary<string> = fc
    .tuple(
        fc.array(emailLocalCharArb, { minLength: 1, maxLength: 60 }),
        fc.array(emailDomainCharArb, { minLength: 1, maxLength: 30 }),
        fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), {
            minLength: 2,
            maxLength: 12,
        }),
    )
    .map(([local, domainLabel, tld]) => {
        // Sanitize local: cannot start/end with '.' or '-' to keep things safe.
        let l = local.join("");
        if (l.startsWith(".") || l.startsWith("-")) l = "a" + l.slice(1);
        if (l.endsWith(".") || l.endsWith("-")) l = l.slice(0, -1) + "a";
        // Sanitize domain label: cannot start/end with '-'.
        let d = domainLabel.join("");
        if (d.startsWith("-")) d = "a" + d.slice(1);
        if (d.endsWith("-")) d = d.slice(0, -1) + "a";
        return `${l}@${d}.${tld.join("")}`;
    })
    .filter((e) => e.length >= 5 && e.length <= 254);

/**
 * Invalid email: missing '@', missing dot in domain, exceeds 254 chars, etc.
 */
export const invalidEmailArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant(""),
    fc.constant("a"),
    fc.constant("ab@c"),
    fc.constant("noatsign.com"),
    fc.constant("@nolocal.com"),
    fc.constant("nodot@domain"),
    fc.string({ minLength: 255, maxLength: 300 }).map((s) => s + "@x.io"),
);

// ---------------------------------------------------------------------------
// Identificador — Requirement 2.5: ^[A-Za-z0-9_]{3,30}$
// ---------------------------------------------------------------------------

export const validIdentificadorArb: fc.Arbitrary<string> = fc
    .array(identifierCharArb, { minLength: 3, maxLength: 30 })
    .map((cs) => cs.join(""));

export const invalidIdentificadorArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant(""),
    fc.constant("ab"), // too short
    fc.string({ minLength: 31, maxLength: 50 }).map((s) =>
        s.replace(/[^A-Za-z0-9_]/g, "x"),
    ).filter((s) => s.length >= 31), // too long but allowed chars
    fc.constantFrom("user name", "user-name", "user.name", "user@name", "us!"),
);

// ---------------------------------------------------------------------------
// Senha — Requirement 2.8: comprimento 8..128
// ---------------------------------------------------------------------------

export const validSenhaArb: fc.Arbitrary<string> = fc.string({
    minLength: 8,
    maxLength: 128,
});

export const invalidSenhaArb: fc.Arbitrary<string> = fc.oneof(
    fc.string({ minLength: 0, maxLength: 7 }),
    fc.string({ minLength: 129, maxLength: 200 }),
);

// ---------------------------------------------------------------------------
// Telefone — Requirement 3.8: 10..11 dígitos depois de remover '+ ( ) - espaço'
// ---------------------------------------------------------------------------

const digitArb = fc.constantFrom(..."0123456789".split(""));

/**
 * Inserts mask characters at random positions of an all-digits string while
 * keeping the digit count unchanged. Used to assert the validator strips them.
 */
function decorateDigits(digits: string, decorations: string[]): string {
    const positions = decorations.length === 0 ? [] : decorations;
    let out = digits;
    for (const ch of positions) {
        const insertAt = Math.floor((ch.charCodeAt(0) % out.length) + 0);
        out = out.slice(0, insertAt) + ch + out.slice(insertAt);
    }
    return out;
}

const maskCharArb = fc.constantFrom("+", " ", "(", ")", "-");

/** Valid `telefone`: 10 or 11 digits, optionally decorated with mask chars. */
export const validTelefoneArb: fc.Arbitrary<string> = fc
    .tuple(
        fc.integer({ min: 10, max: 11 }),
        fc.array(maskCharArb, { minLength: 0, maxLength: 6 }),
    )
    .chain(([nDigits, masks]) =>
        fc
            .array(digitArb, { minLength: nDigits, maxLength: nDigits })
            .map((ds) => decorateDigits(ds.join(""), masks)),
    );

/**
 * Invalid `telefone`: digit count outside [10, 11] after stripping the mask
 * characters, OR contains characters that are neither digits nor mask chars.
 */
export const invalidTelefoneArb: fc.Arbitrary<string> = fc.oneof(
    fc.array(digitArb, { minLength: 0, maxLength: 9 }).map((ds) => ds.join("")),
    fc.array(digitArb, { minLength: 12, maxLength: 20 }).map((ds) => ds.join("")),
    fc.constantFrom("(11) 9abc-1234", "abcdefghij", "11 99999_9999"),
);

// ---------------------------------------------------------------------------
// Descrição — Requirement 3.9: comprimento 1..1000
// ---------------------------------------------------------------------------

export const validDescricaoArb: fc.Arbitrary<string> = fc.string({
    minLength: 1,
    maxLength: 1000,
});

export const invalidDescricaoArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant(""),
    fc.string({ minLength: 1001, maxLength: 1500 }),
);

// ---------------------------------------------------------------------------
// Foto de Perfil — Requirement 3.10: mime ∈ {jpeg,png,webp}, sizeBytes ≤ 10MB
// ---------------------------------------------------------------------------

export type FotoPerfilGen = {
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    sizeBytes: number;
};

const TEN_MB = 10 * 1024 * 1024;

export const validFotoPerfilArb: fc.Arbitrary<FotoPerfilGen> = fc.record({
    mimeType: fc.constantFrom("image/jpeg", "image/png", "image/webp") as fc.Arbitrary<
        FotoPerfilGen["mimeType"]
    >,
    sizeBytes: fc.integer({ min: 1, max: TEN_MB }),
});

/**
 * Invalid foto de perfil: either an unsupported MIME type or size > 10 MB.
 */
export const invalidFotoPerfilArb: fc.Arbitrary<{ mimeType: string; sizeBytes: number }> =
    fc.oneof(
        fc.record({
            mimeType: fc.constantFrom(
                "image/gif",
                "image/bmp",
                "image/tiff",
                "application/pdf",
                "text/plain",
            ),
            sizeBytes: fc.integer({ min: 1, max: TEN_MB }),
        }),
        fc.record({
            mimeType: fc.constantFrom("image/jpeg", "image/png", "image/webp"),
            sizeBytes: fc.integer({ min: TEN_MB + 1, max: TEN_MB * 3 }),
        }),
    );

// ---------------------------------------------------------------------------
// Plano — Requirement 5: tipos válidos
// ---------------------------------------------------------------------------

export type PlanoTipoGen = "BASICO" | "PREMIUM";

export const planoTipoArb: fc.Arbitrary<PlanoTipoGen> = fc.constantFrom(
    "BASICO",
    "PREMIUM",
);

/** Strings that are NOT valid plano tipos (case-sensitive). */
export const invalidPlanoTipoArb: fc.Arbitrary<string> = fc
    .string({ minLength: 0, maxLength: 20 })
    .filter((s) => s !== "BASICO" && s !== "PREMIUM");

// ---------------------------------------------------------------------------
// Composite inputs
// ---------------------------------------------------------------------------

export type CadastroClienteInputGen = {
    nome: string;
    email: string;
    identificador: string;
    senha: string;
};

export const cadastroClienteInputArb: fc.Arbitrary<CadastroClienteInputGen> = fc.record({
    nome: validNomeArb,
    email: validEmailArb,
    identificador: validIdentificadorArb,
    senha: validSenhaArb,
});

/**
 * Onboarding payload as used in the design's `OnboardingData`. The localidade
 * pair (`estadoSigla`, `cidadeNome`) is generated from a fixed seed of valid
 * UFs so tests can be written without coupling to the real IBGE response.
 */
export type OnboardingDataGen = {
    nome: string;
    email: string;
    identificador: string;
    senha: string;
    telefone: string;
    estadoSigla: string;
    cidadeNome: string;
    descricao: string;
    fotoPerfil: FotoPerfilGen;
};

const UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
    "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
    "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export const ufArb: fc.Arbitrary<string> = fc.constantFrom(...UFS);

const validCidadeArb: fc.Arbitrary<string> = fc
    .array(
        fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ".split("")),
        { minLength: 2, maxLength: 60 },
    )
    .map((cs) => {
        let s = cs.join("").trim();
        if (s.length < 2) s = "Sao Paulo";
        return s;
    });

export const onboardingDataArb: fc.Arbitrary<OnboardingDataGen> = fc.record({
    nome: validNomeArb,
    email: validEmailArb,
    identificador: validIdentificadorArb,
    senha: validSenhaArb,
    telefone: validTelefoneArb,
    estadoSigla: ufArb,
    cidadeNome: validCidadeArb,
    descricao: validDescricaoArb,
    fotoPerfil: validFotoPerfilArb,
});

// ---------------------------------------------------------------------------
// IBGE cache + fallback (Property 20)
// ---------------------------------------------------------------------------

/** State of the IBGE cache for a given key. */
export type CacheState = "AUSENTE" | "VALIDO" | "EXPIRADO";

/** External behavior of the IBGE API for a single call. */
export type IbgeBehavior = "OK" | "TIMEOUT" | "ERRO";

export const cacheStateArb: fc.Arbitrary<CacheState> = fc.constantFrom(
    "AUSENTE",
    "VALIDO",
    "EXPIRADO",
);

export const ibgeBehaviorArb: fc.Arbitrary<IbgeBehavior> = fc.constantFrom(
    "OK",
    "TIMEOUT",
    "ERRO",
);
