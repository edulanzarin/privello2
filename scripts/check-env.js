#!/usr/bin/env node
/* eslint-disable */
/**
 * Privello environment validation gate.
 *
 * Bloqueia a inicialização do servidor quando alguma variável obrigatória está
 * ausente. Roda em Node puro (sem TypeScript) para ser executável diretamente
 * dentro do estágio runtime do Docker, antes de subir o Next.js.
 *
 * Mantém o conjunto de chaves duplicado (em vez de importar `lib/env.ts`)
 * porque o estágio runtime da imagem não tem o `tsx`/`ts-node` disponíveis.
 * O teste de paridade (Property 30) garante que esta lista permanece em
 * sincronia com `ENV_KEYS` em `src/lib/env.ts` e com `.env.example`.
 *
 * Requirements: 7.5.
 */

"use strict";

const REQUIRED_ENV_KEYS = [
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
];

function findMissing(source) {
    const missing = [];
    for (const key of REQUIRED_ENV_KEYS) {
        const value = source[key];
        if (value === undefined || value === "") {
            missing.push(key);
        }
    }
    return missing;
}

function main() {
    const missing = findMissing(process.env);

    if (missing.length === 0) {
        // Sucesso silencioso: comportamento amigável para uso em CMD do Docker.
        process.exit(0);
    }

    const header =
        "[privello] Falha na validação de variáveis de ambiente. Variáveis ausentes:";
    process.stderr.write(header + "\n");
    for (const key of missing) {
        process.stderr.write(`  - ${key}\n`);
    }
    process.stderr.write(
        `[privello] Total de variáveis ausentes: ${missing.length}. ` +
        "Defina-as antes de iniciar o servidor.\n",
    );

    process.exit(1);
}

main();
