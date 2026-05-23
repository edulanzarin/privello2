#!/usr/bin/env node
/**
 * Privello: lint estático de domain leakage nos primitivos da
 * Biblioteca_de_Componentes.
 *
 * Garante que os componentes em `src/components/primitives/` permaneçam
 * acoplados apenas a estados de UI e nunca exponham nomes de props (ou
 * tipos de props) que carreguem entidades de domínio do produto. Isto
 * implementa o invariante exigido pelo Requirement 6.5 e dá suporte às
 * exigências 6.1 e 6.2 ao manter a biblioteca genuinamente reutilizável
 * por todas as páginas.
 *
 * Como executar:
 *
 *   npm run lint:primitives
 *
 * Saída:
 * - Exit code 0 quando nenhuma violação é encontrada.
 * - Exit code 1 quando há ao menos um vazamento, com cada violação
 *   listada no formato `arquivo:linha:coluna → descrição` para facilitar
 *   navegação a partir do terminal.
 *
 * Estratégia:
 * - Lê todos os arquivos `.ts`/`.tsx` em `src/components/primitives/` (não
 *   recursivo, mas tolerante a subpastas) e parseia cada um com a API do
 *   compilador TypeScript.
 * - Para cada `interface` e `type alias` declarado, inspeciona:
 *   1. O próprio nome da declaração (ex.: `interface ButtonProps`).
 *   2. Cada `PropertySignature`: nome da prop e tipo declarado.
 *   3. `TypeReferenceNode` aninhados (ex.: `prop: ListaCliente`).
 *   4. `ExpressionWithTypeArguments` em cláusulas `extends`/`implements`.
 * - Em cada caso, compara o identificador (case-insensitive, por
 *   substring) com o conjunto fechado de termos proibidos definido por
 *   contrato com o time de produto.
 *
 * Requirements: 6.1, 6.2, 6.5.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import * as ts from "typescript";

/**
 * Termos proibidos em nomes de props ou nomes de tipos referenciados por
 * props dos primitivos. A comparação é case-insensitive e por substring,
 * de modo que variações como `Cliente`, `clienteId`, `PlanoBasico` ou
 * `isPremium` sejam capturadas. Mantenha esta lista alinhada com o
 * vocabulário do glossário de requisitos.
 */
const FORBIDDEN_TOKENS = [
    "cliente",
    "acompanhante",
    "plano",
    "basico",
    "premium",
] as const;

interface Violation {
    file: string;
    line: number;
    column: number;
    description: string;
    token: string;
}

function findForbiddenToken(identifier: string): string | null {
    const lower = identifier.toLowerCase();
    for (const token of FORBIDDEN_TOKENS) {
        if (lower.includes(token)) return token;
    }
    return null;
}

function recordViolation(
    sourceFile: ts.SourceFile,
    node: ts.Node,
    description: string,
    token: string,
    violations: Violation[],
): void {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
    );
    violations.push({
        file: sourceFile.fileName,
        line: line + 1,
        column: character + 1,
        description,
        token,
    });
}

function getQualifiedRightmostName(name: ts.EntityName): string {
    if (ts.isIdentifier(name)) return name.text;
    return name.right.text;
}

function checkTypeContainer(
    ownerLabel: string,
    container: ts.Node,
    sourceFile: ts.SourceFile,
    violations: Violation[],
): void {
    const visit = (node: ts.Node): void => {
        if (
            ts.isPropertySignature(node) &&
            node.name &&
            ts.isIdentifier(node.name)
        ) {
            const propName = node.name.text;
            const tokenInName = findForbiddenToken(propName);
            if (tokenInName) {
                recordViolation(
                    sourceFile,
                    node.name,
                    `prop "${propName}" em ${ownerLabel}`,
                    tokenInName,
                    violations,
                );
            }
        }

        if (ts.isTypeReferenceNode(node)) {
            const refName = getQualifiedRightmostName(node.typeName);
            const token = findForbiddenToken(refName);
            if (token) {
                recordViolation(
                    sourceFile,
                    node,
                    `tipo "${refName}" referenciado em ${ownerLabel}`,
                    token,
                    violations,
                );
            }
        }

        if (ts.isExpressionWithTypeArguments(node)) {
            const expr = node.expression;
            let name = "";
            if (ts.isIdentifier(expr)) {
                name = expr.text;
            } else if (
                ts.isPropertyAccessExpression(expr) &&
                ts.isIdentifier(expr.name)
            ) {
                name = expr.name.text;
            }
            if (name) {
                const token = findForbiddenToken(name);
                if (token) {
                    recordViolation(
                        sourceFile,
                        node,
                        `herança/composição de "${name}" em ${ownerLabel}`,
                        token,
                        violations,
                    );
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(container);
}

function checkSourceFile(
    sourceFile: ts.SourceFile,
    violations: Violation[],
): void {
    const visit = (node: ts.Node): void => {
        if (ts.isInterfaceDeclaration(node)) {
            const declName = node.name.text;
            const tokenInName = findForbiddenToken(declName);
            if (tokenInName) {
                recordViolation(
                    sourceFile,
                    node.name,
                    `nome de interface "${declName}"`,
                    tokenInName,
                    violations,
                );
            }
            checkTypeContainer(
                `interface ${declName}`,
                node,
                sourceFile,
                violations,
            );
            return;
        }

        if (ts.isTypeAliasDeclaration(node)) {
            const declName = node.name.text;
            const tokenInName = findForbiddenToken(declName);
            if (tokenInName) {
                recordViolation(
                    sourceFile,
                    node.name,
                    `nome de type alias "${declName}"`,
                    tokenInName,
                    violations,
                );
            }
            checkTypeContainer(
                `type ${declName}`,
                node,
                sourceFile,
                violations,
            );
            return;
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
}

function listPrimitiveFiles(rootDir: string): string[] {
    const result: string[] = [];
    const stack = [rootDir];
    while (stack.length > 0) {
        const current = stack.pop()!;
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
                result.push(full);
            }
        }
    }
    result.sort();
    return result;
}

function main(): void {
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "..");
    const primitivesDir = path.join(
        repoRoot,
        "src",
        "components",
        "primitives",
    );

    if (!fs.existsSync(primitivesDir)) {
        process.stderr.write(
            `[lint-primitives] Diretório não encontrado: ${primitivesDir}\n`,
        );
        process.exit(1);
    }

    const files = listPrimitiveFiles(primitivesDir);
    if (files.length === 0) {
        process.stderr.write(
            `[lint-primitives] Nenhum arquivo .ts/.tsx encontrado em ${primitivesDir}\n`,
        );
        process.exit(1);
    }

    const violations: Violation[] = [];
    for (const filePath of files) {
        const text = fs.readFileSync(filePath, "utf8");
        const sourceFile = ts.createSourceFile(
            filePath,
            text,
            ts.ScriptTarget.Latest,
            /* setParentNodes */ true,
            filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        checkSourceFile(sourceFile, violations);
    }

    if (violations.length === 0) {
        process.stdout.write(
            `[lint-primitives] OK: nenhum termo de domínio encontrado em ${files.length} arquivo(s).\n`,
        );
        process.exit(0);
    }

    process.stderr.write(
        `[lint-primitives] ${violations.length} vazamento(s) de domínio encontrado(s):\n`,
    );
    for (const v of violations) {
        const rel = path.relative(repoRoot, v.file).replace(/\\/g, "/");
        process.stderr.write(
            `  ${rel}:${v.line}:${v.column} → ${v.description} contém termo proibido "${v.token}"\n`,
        );
    }
    process.exit(1);
}

main();
