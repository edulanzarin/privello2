/**
 * Feature: privello-platform, Property 29: Componentes primitivos não vazam
 * nomes do domínio.
 *
 * **Property 29: Componentes primitivos não vazam nomes do domínio**
 *
 * **Validates: Requirements 6.5**
 *
 * Para todo componente exportado de `src/components/primitives/*`, o conjunto
 * de nomes de props públicas (em type aliases, interfaces, destructuring de
 * parâmetros e tags JSDoc `@prop`/`@property`) não contém, por substring
 * case-insensitive, nenhum dos termos do domínio listados em
 * {@link FORBIDDEN_TERMS}. Isto evita que a Biblioteca_de_Componentes acople
 * componentes genéricos a entidades específicas das páginas que os consomem
 * (Cliente, Acompanhante, Plano_Basico, Plano_Premium), cumprindo o invariante
 * exigido pelo Requirement 6.5.
 *
 * Estratégia:
 *
 * 1. Listar de forma estática (síncrona) todos os arquivos `.tsx` em
 *    `src/components/primitives/`.
 * 2. Parsear cada arquivo com a API do compilador TypeScript (a mesma
 *    biblioteca já presente em `node_modules` por dependência transitiva do
 *    Next.js + scripts internos) e extrair, sem inferência de tipos, os nomes
 *    de props públicas vindos de quatro fontes:
 *      a) Membros de `interface` (PropertySignature).
 *      b) Membros de type literais dentro de `type alias` (com walk em
 *         uniões/interseções para cobrir uniões discriminadas).
 *      c) Identificadores em padrões de destructuring na lista de parâmetros
 *         de declarações de função e variáveis com inicializadores
 *         função/arrow function (a "API" efetiva do componente em runtime).
 *      d) Nomes citados em tags JSDoc `@prop` ou `@property`.
 * 3. Universo da quantificação: `primitives × forbidden-terms`. fast-check
 *    sorteia pares e a propriedade falha se algum nome de prop daquele
 *    arquivo contiver o termo (substring, case-insensitive). `numRuns: 100`
 *    garante reamostragem suficiente sobre as 4×5 = 20 combinações.
 * 4. Como a propriedade é estrutural sobre dados estáticos, também há uma
 *    asserção agregada que lista todos os infratores de uma vez para
 *    facilitar correção em massa caso a propriedade falhe.
 *
 * Observação: a checagem é puramente sintática — não acionamos o type checker
 * do TS. Isto é proposital: queremos detectar "vazamento de nome", não
 * verificar se o nome resolve para um símbolo do domínio. Nomes proibidos
 * vazariam mesmo se o tipo final fosse `string`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";

import * as fc from "fast-check";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const PRIMITIVES_DIR = path.resolve(
    PROJECT_ROOT,
    "src",
    "components",
    "primitives",
);

/**
 * Termos de domínio cuja presença em qualquer nome de prop pública dos
 * primitivos é considerada vazamento. A comparação é por substring
 * case-insensitive, então variações flexionais (`clientes`, `planoBasico`,
 * `isPremium`, `acompanhanteId`) também são capturadas. Mantenha alinhado com
 * o glossário de requisitos (Requirement 6.5).
 */
const FORBIDDEN_TERMS = [
    "cliente",
    "acompanhante",
    "plano",
    "basico",
    "premium",
] as const;
type ForbiddenTerm = (typeof FORBIDDEN_TERMS)[number];

/**
 * Origem de uma prop encontrada. Útil em mensagens de erro para que um futuro
 * mantenedor saiba se o vazamento veio de uma `interface`, de um `type` literal,
 * do destructuring do componente, ou de um comentário JSDoc.
 */
type PropSource =
    | "interface"
    | "type-literal"
    | "destructured-param"
    | "jsdoc-prop";

interface PropEntry {
    /** Caminho absoluto do arquivo onde a prop foi encontrada. */
    readonly file: string;
    /**
     * Identificador do "dono" sintático da prop: nome da interface, do type
     * alias, da função, ou um marcador para JSDoc/anônimos.
     */
    readonly ownerName: string;
    /** Nome literal da prop, exatamente como aparece no código-fonte. */
    readonly propName: string;
    /** Origem sintática da prop (ver {@link PropSource}). */
    readonly source: PropSource;
}

/** Lista todos os arquivos `.tsx` do diretório de primitivos (não recursivo). */
function listPrimitiveTsxFiles(dir: string): string[] {
    const result: string[] = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const full = path.join(dir, entry);
        const stats = statSync(full);
        if (stats.isFile() && entry.toLowerCase().endsWith(".tsx")) {
            // Normaliza para POSIX para alinhar com `ts.SourceFile.fileName`,
            // que o compilador TypeScript reescreve para usar `/` mesmo no
            // Windows. Sem essa normalização, a comparação string × string
            // entre `PropEntry.file` (vindo do TS) e o caminho da varredura
            // (vindo do `node:fs`) divergiria pelos separadores.
            result.push(full.split(path.sep).join("/"));
        }
    }
    result.sort();
    return result;
}

/**
 * Extrai o nome textual de uma `PropertyName` quando ela é representável como
 * string (Identifier, StringLiteral, NumericLiteral). Retorna `null` para
 * casos que não correspondem a "nome de prop público" (ex.: ComputedPropertyName
 * com expressão dinâmica).
 */
function readPropertyName(name: ts.PropertyName | undefined): string | null {
    if (!name) return null;
    if (ts.isIdentifier(name)) return name.text;
    if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
        return name.text;
    }
    if (ts.isNumericLiteral(name)) return name.text;
    if (ts.isPrivateIdentifier(name)) {
        // Identificadores privados (#foo) não fazem parte da API pública.
        return null;
    }
    return null;
}

/** Extrai membros (PropertySignature) de um conjunto de `TypeElement`s. */
function collectFromTypeElements(
    members: ts.NodeArray<ts.TypeElement>,
    ownerName: string,
    file: string,
    source: PropSource,
    out: PropEntry[],
): void {
    for (const member of members) {
        if (ts.isPropertySignature(member)) {
            const propName = readPropertyName(member.name);
            if (propName !== null) {
                out.push({ file, ownerName, propName, source });
            }
        }
    }
}

/**
 * Recursivamente extrai membros de `TypeLiteralNode`s aninhados em uniões e
 * interseções. Cobre a indicação do design de "uniões discriminadas".
 */
function collectFromTypeNode(
    typeNode: ts.TypeNode,
    ownerName: string,
    file: string,
    out: PropEntry[],
): void {
    if (ts.isTypeLiteralNode(typeNode)) {
        collectFromTypeElements(
            typeNode.members,
            ownerName,
            file,
            "type-literal",
            out,
        );
        return;
    }
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
        for (const sub of typeNode.types) {
            collectFromTypeNode(sub, ownerName, file, out);
        }
        return;
    }
    if (ts.isParenthesizedTypeNode(typeNode)) {
        collectFromTypeNode(typeNode.type, ownerName, file, out);
        return;
    }
    // Outros tipos (TypeReference, etc.) não declaram nomes de prop locais
    // relevantes para esta propriedade.
}

/** Extrai props vindas do destructuring de parâmetros de uma função. */
function collectFromParameters(
    parameters: ts.NodeArray<ts.ParameterDeclaration>,
    ownerName: string,
    file: string,
    out: PropEntry[],
): void {
    for (const param of parameters) {
        if (!ts.isObjectBindingPattern(param.name)) continue;
        for (const elem of param.name.elements) {
            // Para `{ "aria-describedby": x }`, propertyName é a string-literal,
            // que é o nome exposto da prop. Para `{ foo }`, propertyName é
            // undefined e elem.name === foo, então o próprio binding name é a
            // prop. Para `{ foo: bar }`, propertyName === foo, name === bar.
            let propName: string | null = null;
            if (elem.propertyName) {
                if (ts.isIdentifier(elem.propertyName)) {
                    propName = elem.propertyName.text;
                } else if (
                    ts.isStringLiteral(elem.propertyName) ||
                    ts.isNoSubstitutionTemplateLiteral(elem.propertyName)
                ) {
                    propName = elem.propertyName.text;
                } else if (ts.isNumericLiteral(elem.propertyName)) {
                    propName = elem.propertyName.text;
                }
            } else if (ts.isIdentifier(elem.name)) {
                propName = elem.name.text;
            }
            if (propName !== null) {
                out.push({
                    file,
                    ownerName,
                    propName,
                    source: "destructured-param",
                });
            }
        }
    }
}

/**
 * Walk principal da AST coletando interfaces, type aliases e funções
 * exportáveis. Usa `forEachChild` em todos os nodes para cobrir declarações
 * dentro de namespaces ou blocos export, embora os primitivos atuais sejam
 * planos.
 */
function extractPropsFromSourceFile(
    sourceFile: ts.SourceFile,
    out: PropEntry[],
): void {
    const visit = (node: ts.Node): void => {
        if (ts.isInterfaceDeclaration(node)) {
            collectFromTypeElements(
                node.members,
                node.name.text,
                sourceFile.fileName,
                "interface",
                out,
            );
        } else if (ts.isTypeAliasDeclaration(node)) {
            collectFromTypeNode(
                node.type,
                node.name.text,
                sourceFile.fileName,
                out,
            );
        } else if (ts.isFunctionDeclaration(node)) {
            const ownerName = node.name?.text ?? "<anonymous-function>";
            collectFromParameters(
                node.parameters,
                ownerName,
                sourceFile.fileName,
                out,
            );
        } else if (ts.isVariableStatement(node)) {
            for (const decl of node.declarationList.declarations) {
                if (
                    decl.initializer &&
                    (ts.isArrowFunction(decl.initializer) ||
                        ts.isFunctionExpression(decl.initializer)) &&
                    ts.isIdentifier(decl.name)
                ) {
                    collectFromParameters(
                        decl.initializer.parameters,
                        decl.name.text,
                        sourceFile.fileName,
                        out,
                    );
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
}

/**
 * Captura nomes em tags JSDoc `@prop`/`@property`. As assinaturas comuns são:
 *
 *   @prop {Type} nome - descrição
 *   @property nome
 *
 * O regex tolera tipos opcionais entre chaves e qualquer descrição posterior.
 */
const JSDOC_PROP_RE =
    /@(?:prop|property)(?:\s+\{[^}]*\})?\s+([A-Za-z_$][\w$]*)/g;

function extractJsDocPropsFromText(
    text: string,
    file: string,
    out: PropEntry[],
): void {
    JSDOC_PROP_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = JSDOC_PROP_RE.exec(text)) !== null) {
        out.push({
            file,
            ownerName: "<jsdoc>",
            propName: match[1],
            source: "jsdoc-prop",
        });
    }
}

function extractPropsFromFile(filePath: string): PropEntry[] {
    const text = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        ts.ScriptKind.TSX,
    );
    const props: PropEntry[] = [];
    extractPropsFromSourceFile(sourceFile, props);
    extractJsDocPropsFromText(text, filePath, props);
    return props;
}

/** Caminho relativo à raiz do repositório, com separador POSIX. */
function relativeToRepo(absolutePath: string): string {
    return path
        .relative(PROJECT_ROOT, absolutePath)
        .split(path.sep)
        .join("/");
}

function findForbiddenTermInProp(
    propName: string,
): ForbiddenTerm | null {
    const lower = propName.toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
        if (lower.includes(term)) return term;
    }
    return null;
}

// Coleta estática feita uma única vez: o universo é fixo no momento do load
// dos testes para que `fc.constantFrom` receba arrays estáveis.
const PRIMITIVE_FILES = listPrimitiveTsxFiles(PRIMITIVES_DIR);
const ALL_PROPS: PropEntry[] = PRIMITIVE_FILES.flatMap(extractPropsFromFile);

describe("Property 29: Componentes primitivos não vazam nomes do domínio", () => {
    it("descobre primitivos e extrai pelo menos uma prop por arquivo (sanity)", () => {
        // Sem arquivos descobertos, a quantificação seria vacuamente
        // verdadeira e esconderia tanto regressões na varredura quanto
        // remoção acidental dos primitivos.
        expect(
            PRIMITIVE_FILES.length,
            `Esperava-se ao menos um .tsx em ${relativeToRepo(PRIMITIVES_DIR)}`,
        ).toBeGreaterThan(0);

        for (const file of PRIMITIVE_FILES) {
            const propsHere = ALL_PROPS.filter((p) => p.file === file);
            expect(
                propsHere.length,
                `Nenhuma prop foi extraída de ${relativeToRepo(file)}; ` +
                "a varredura de AST/JSDoc pode ter regredido.",
            ).toBeGreaterThan(0);
        }
    });

    it("para todo (primitivo, termo proibido), nenhum nome de prop contém o termo", () => {
        // Universo da quantificação: produto cartesiano (arquivos × termos).
        // fast-check sorteia pares e, com numRuns=100 sobre |4×5|=20 pares,
        // garante reamostragem múltipla por combinação.
        fc.assert(
            fc.property(
                fc.constantFrom(...PRIMITIVE_FILES),
                fc.constantFrom(...FORBIDDEN_TERMS),
                (file, term) => {
                    const propsInFile = ALL_PROPS.filter(
                        (p) => p.file === file,
                    );
                    const violators = propsInFile.filter((p) =>
                        p.propName.toLowerCase().includes(term),
                    );
                    if (violators.length === 0) return true;
                    const detail = violators
                        .map(
                            (v) =>
                                `${v.source}:${v.ownerName}.${v.propName}`,
                        )
                        .join(", ");
                    throw new Error(
                        `Quebra de Property 29 em ${relativeToRepo(file)}: ` +
                        `prop(s) contendo termo proibido "${term}" — ${detail}`,
                    );
                },
            ),
            { numRuns: 100 },
        );

        // Asserção complementar: lista agregada de todos os vazamentos para
        // facilitar correção em massa caso o teste falhe. Independente do
        // run de fast-check, esta varredura é determinística sobre todo o
        // produto cartesiano.
        const aggregated: string[] = [];
        for (const prop of ALL_PROPS) {
            const term = findForbiddenTermInProp(prop.propName);
            if (term !== null) {
                aggregated.push(
                    `${relativeToRepo(prop.file)} (${prop.source} ${prop.ownerName}.${prop.propName}) → "${term}"`,
                );
            }
        }
        expect(
            aggregated,
            "Vazamentos de domínio detectados nos primitivos",
        ).toEqual([]);
    });
});
