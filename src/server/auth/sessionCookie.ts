import { getEnv } from "@/lib/env";

/**
 * Sistema_de_Autenticacao — assinatura HMAC do cookie de sessão.
 *
 * Este módulo é a contraparte **Edge-safe** do repositório de sessões
 * em `src/server/auth/sessions.ts`. Ele expõe apenas
 * {@link signSessionCookie} e {@link verifySessionCookie}, que dependem
 * exclusivamente da Web Crypto API (`globalThis.crypto.subtle`),
 * suportada tanto no Edge Runtime do Next.js quanto no runtime Node.js
 * (>= 20).
 *
 * # Por que Web Crypto, não `node:crypto`
 *
 * O `src/middleware.ts` da Privello roda no Edge Runtime, que **não
 * suporta** módulos `node:*` (incluindo `node:crypto`). Webpack falha
 * com `UnhandledSchemeError: Reading from "node:crypto" is not handled
 * by plugins`. A Web Crypto API resolve isso porque está disponível em
 * ambos os runtimes pelo mesmo nome global (`crypto.subtle`).
 *
 * # Por que as funções são `async`
 *
 * `crypto.subtle.importKey` e `crypto.subtle.sign`/`verify` são
 * assíncronas por design (a especificação prevê hardware-backed crypto
 * que pode levar I/O). Isso obriga `signSessionCookie` e
 * `verifySessionCookie` a serem `async` também — todos os callers
 * foram atualizados para usar `await`.
 *
 * # Formato do cookie
 *
 * `<sessionId>.<base64url(hmac)>` — mesmo formato anterior.
 */

/** Separador entre `sessionId` e assinatura HMAC no cookie. */
const COOKIE_SEPARATOR = ".";

/**
 * Cache do `CryptoKey` derivado de `SESSION_SECRET`. Importar a chave
 * é uma operação cara o bastante para valer a pena cachear; o
 * `SESSION_SECRET` não muda durante a vida do processo.
 */
let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

async function getKey(): Promise<CryptoKey> {
    const { SESSION_SECRET } = getEnv();
    if (cachedKey !== null && cachedSecret === SESSION_SECRET) {
        return cachedKey;
    }
    const enc = new TextEncoder();
    cachedKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(SESSION_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
    cachedSecret = SESSION_SECRET;
    return cachedKey;
}

/**
 * Codifica um `ArrayBuffer` em base64url sem padding. Implementação
 * portátil entre Node e Edge (não usa `Buffer`).
 */
function toBase64Url(bytes: ArrayBuffer): string {
    const arr = new Uint8Array(bytes);
    let binary = "";
    for (let i = 0; i < arr.length; i++) {
        binary += String.fromCharCode(arr[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodifica uma string base64url (sem padding) em `Uint8Array`.
 * Retorna `null` em caso de input inválido (caracteres fora do
 * alfabeto base64url) — usado por `verifySessionCookie` para rejeitar
 * cookies malformados sem lançar.
 */
function fromBase64Url(input: string): Uint8Array | null {
    if (!/^[A-Za-z0-9_-]*$/.test(input)) {
        return null;
    }
    let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
        base64 += "=";
    }
    let binary: string;
    try {
        binary = atob(base64);
    } catch {
        return null;
    }
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

/**
 * Compara duas sequências de bytes em tempo constante. Retorna `false`
 * imediatamente para tamanhos diferentes; o `crypto.subtle.verify`
 * chamado por {@link verifySessionCookie} já é constante por contrato,
 * então este helper só é usado para o early-out de tamanho.
 */
function sameLength(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length;
}

/**
 * Serializa um `sessionId` no formato de cookie assinado por HMAC.
 *
 * O valor retornado tem a forma `<sessionId>.<base64url(hmac)>` e é
 * destinado a ser colocado em um cookie HTTP-only marcado como
 * `Secure` e `SameSite=Lax` pela camada HTTP.
 *
 * @param sessionId Identificador opaco da sessão (chave primária).
 * @returns Valor assinado para uso direto no header `Set-Cookie`.
 */
export async function signSessionCookie(sessionId: string): Promise<string> {
    const key = await getKey();
    const enc = new TextEncoder();
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        enc.encode(sessionId),
    );
    return `${sessionId}${COOKIE_SEPARATOR}${toBase64Url(signature)}`;
}

/**
 * Verifica um cookie de sessão e devolve o `sessionId` quando a
 * assinatura HMAC bate. Retorna `null` para qualquer formato inválido,
 * assinatura incorreta ou valor ausente — sem lançar.
 *
 * @param value Valor bruto lido do cookie (incluindo a assinatura).
 * @returns `sessionId` quando válido; `null` caso contrário.
 */
export async function verifySessionCookie(
    value: string | null | undefined,
): Promise<string | null> {
    if (!value) {
        return null;
    }
    const separatorIndex = value.lastIndexOf(COOKIE_SEPARATOR);
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
        return null;
    }
    const sessionId = value.slice(0, separatorIndex);
    const signatureRaw = value.slice(separatorIndex + 1);

    const provided = fromBase64Url(signatureRaw);
    if (provided === null) {
        return null;
    }

    const key = await getKey();
    const enc = new TextEncoder();
    // `crypto.subtle.verify` é constante em tempo por contrato; basta
    // garantir que o tamanho bate antes de chamar.
    const expectedLength = 32; // SHA-256 → 32 bytes
    if (!sameLength(provided, new Uint8Array(expectedLength))) {
        return null;
    }
    const ok = await crypto.subtle.verify(
        "HMAC",
        key,
        provided,
        enc.encode(sessionId),
    );
    return ok ? sessionId : null;
}
