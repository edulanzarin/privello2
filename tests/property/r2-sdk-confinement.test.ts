/**
 * Feature: privello-platform, Property 32: Confinamento do SDK do Cloudflare R2
 *
 * **Property 32: Confinamento do SDK do Cloudflare R2**
 *
 * **Validates: Requirements 7.7**
 *
 * Cloudflare R2 é S3-compatível e nossa única ponte com a API do R2 é
 * `src/lib/storage/r2.ts`, que usa `@aws-sdk/client-s3` e
 * `@aws-sdk/s3-request-presigner`. O Requirement 7.7 exige que bibliotecas,
 * chamadas e tipos específicos do R2 fiquem confinados a esse módulo: nenhum
 * outro arquivo de `src/**` pode importar o SDK do R2/S3 da AWS.
 *
 * Esta propriedade é estrutural (sobre os arquivos do repositório), então
 * pode ser verificada como um único asserção sobre a lista de arquivos
 * descobertos. Mesmo assim, ela é exposta como uma propriedade fast-check
 * usando `fc.constantFrom` sobre a lista de caminhos descobertos para que a
 * checagem por arquivo seja tratada como uma propriedade individual e a saída
 * em caso de falha aponte para o arquivo problemático.
 */

import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import * as path from "node:path";

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SRC_ROOT = path.resolve(PROJECT_ROOT, "src");

/** Arquivo único autorizado a importar o SDK do S3/R2. */
const ALLOWED_RELATIVE_PATH = path.join("lib", "storage", "r2.ts");

/** Diretórios que nunca devem ser percorridos. */
const EXCLUDED_DIRS = new Set<string>(["node_modules", ".next"]);

/** Extensões consideradas código TypeScript da aplicação. */
const SOURCE_EXTENSIONS = new Set<string>([".ts", ".tsx"]);

/**
 * Caminhada síncrona da árvore `src/`. É feita de forma síncrona para
 * popular a lista de arquivos antes de `describe`/`it` registrarem os
 * casos — `fc.constantFrom` precisa do array no momento da definição.
 *
 * Excluímos `node_modules` e `.next` (mesmo que normalmente não estejam
 * dentro de `src/`, a regra do design é explícita) e ignoramos arquivos
 * que não sejam `.ts` / `.tsx`.
 */
function walkSourceFiles(rootDir: string): string[] {
    const collected: string[] = [];
    const stack: string[] = [rootDir];
    while (stack.length > 0) {
        const current = stack.pop() as string;
        let entries: string[];
        try {
            entries = readdirSync(current);
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (EXCLUDED_DIRS.has(entry)) continue;
            const full = path.join(current, entry);
            let stats;
            try {
                stats = statSync(full);
            } catch {
                continue;
            }
            if (stats.isDirectory()) {
                stack.push(full);
            } else if (stats.isFile()) {
                const ext = path.extname(full).toLowerCase();
                if (SOURCE_EXTENSIONS.has(ext)) {
                    collected.push(full);
                }
            }
        }
    }
    return collected.sort();
}

/**
 * Regex que casa com qualquer especificador de import/require/dynamic-import
 * que aponte para um pacote `@aws-sdk/*` cujo nome contenha `s3`. Cobre:
 *
 *  - `import ... from "@aws-sdk/client-s3"`
 *  - `import "@aws-sdk/s3-request-presigner"`
 *  - `import("@aws-sdk/client-s3")`
 *  - `require("@aws-sdk/client-s3")`
 *  - `export ... from "@aws-sdk/client-s3"` (re-export)
 *
 * O grupo capturado contém o nome do pacote para que o erro da propriedade
 * mostre exatamente qual SDK foi importado.
 */
const FORBIDDEN_IMPORT_RE =
    /(?:import\s+(?:[^"'`;]+?\s+from\s+)?|import\s*\(\s*|require\s*\(\s*|export\s+(?:[^"'`;]+?\s+from\s+))["'`](@aws-sdk\/[^"'`]*s3[^"'`]*)["'`]/g;

/**
 * Procura por imports proibidos no conteúdo de um arquivo. Retorna a lista
 * (deduplicada e ordenada) de pacotes `@aws-sdk/*-s3-*` referenciados.
 */
function findForbiddenImports(content: string): string[] {
    const found = new Set<string>();
    // Cada execução do regex global precisa de um lastIndex independente.
    FORBIDDEN_IMPORT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FORBIDDEN_IMPORT_RE.exec(content)) !== null) {
        found.add(match[1]);
    }
    return [...found].sort();
}

/** Caminho relativo a `src/`, sempre com separador POSIX para mensagens claras. */
function relativeFromSrc(absolutePath: string): string {
    return path
        .relative(SRC_ROOT, absolutePath)
        .split(path.sep)
        .join("/");
}

const SOURCE_FILES = walkSourceFiles(SRC_ROOT);

describe("Property 32: Confinamento do SDK do Cloudflare R2", () => {
    it("descobre pelo menos um arquivo TypeScript em src/ e o módulo permitido existe", () => {
        // Sanidade da busca: se a varredura retornar zero arquivos, a
        // propriedade abaixo passaria vacuamente, o que esconderia o teste.
        expect(SOURCE_FILES.length).toBeGreaterThan(0);
        const allowedAbsolute = path.resolve(SRC_ROOT, ALLOWED_RELATIVE_PATH);
        expect(SOURCE_FILES).toContain(allowedAbsolute);
    });

    it("nenhum arquivo de src/** fora de src/lib/storage/r2.ts importa o SDK do R2/S3", async () => {
        const allowedAbsolute = path.resolve(SRC_ROOT, ALLOWED_RELATIVE_PATH);

        // Pré-leitura paralela para que a propriedade rode contra dados já
        // carregados; isso mantém `fc.assert` síncrono em CPU e o numRuns
        // proporcional ao número de arquivos.
        const fileContents = new Map<string, string>();
        await Promise.all(
            SOURCE_FILES.map(async (file) => {
                fileContents.set(file, await readFile(file, "utf8"));
            }),
        );

        // Confirmação positiva: o arquivo permitido de fato importa o SDK,
        // caso contrário o teste pode passar vacuamente (por exemplo, se o
        // regex regredir e deixar de casar).
        const allowedImports = findForbiddenImports(
            fileContents.get(allowedAbsolute) as string,
        );
        expect(
            allowedImports.length,
            `Esperava-se que ${ALLOWED_RELATIVE_PATH} importasse o SDK do R2/S3, mas nenhum import foi detectado pelo regex de Property 32.`,
        ).toBeGreaterThan(0);

        fc.assert(
            fc.property(fc.constantFrom(...SOURCE_FILES), (file) => {
                if (file === allowedAbsolute) {
                    // O único módulo autorizado a falar com o SDK.
                    return;
                }
                const content = fileContents.get(file) as string;
                const forbidden = findForbiddenImports(content);
                if (forbidden.length > 0) {
                    throw new Error(
                        `Quebra de Property 32: ${relativeFromSrc(file)} importa SDK do R2/S3 ` +
                        `(${forbidden.join(", ")}). Apenas src/${ALLOWED_RELATIVE_PATH.split(path.sep).join("/")} pode falar com o SDK.`,
                    );
                }
            }),
            { numRuns: SOURCE_FILES.length },
        );

        // Asserção complementar com saída agregada: lista todos os arquivos
        // infratores de uma vez para facilitar correção em massa.
        const offenders: string[] = [];
        for (const file of SOURCE_FILES) {
            if (file === allowedAbsolute) continue;
            const content = fileContents.get(file) as string;
            const forbidden = findForbiddenImports(content);
            if (forbidden.length > 0) {
                offenders.push(
                    `${relativeFromSrc(file)} -> ${forbidden.join(", ")}`,
                );
            }
        }
        expect(
            offenders,
            "Arquivos fora de src/lib/storage/r2.ts importando SDK do R2/S3",
        ).toEqual([]);
    });
});
