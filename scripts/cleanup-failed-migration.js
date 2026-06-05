#!/usr/bin/env node
/* eslint-disable */
/**
 * One-shot: limpa entradas órfãs (failed) de migrations problemáticas
 * em `_prisma_migrations` no Postgres antes do `migrate deploy`.
 *
 * # Por quê
 *
 * Algumas migrations da história do projeto falham em bases novas:
 *
 *   1. `20260202_fan_payments`: timestamp original (fevereiro) anterior
 *      à criação do enum `BoostPaymentStatus` (julho). Renomeada para
 *      `20260735000000_fan_payments`, mas a entrada antiga falhada fica
 *      em `_prisma_migrations` e bloqueia o `migrate deploy` (P3009).
 *
 *   2. `20260716000000_fan_planos_com_expiracao`: comparava
 *      `plano_vigente` com `'FAN_24H'`, label que nunca existiu em
 *      bases limpas. Reescrita com bloco PL/pgSQL idempotente, mas a
 *      tentativa anterior também deixa entrada falhada.
 *
 * Este script remove essas entradas antes de re-rodar (idempotente).
 * É seguro: as migrations falham antes de criar/alterar schema (ou
 * quando alteram, são idempotentes via IF EXISTS / IF NOT EXISTS).
 *
 * Usa o Prisma Client (já presente no standalone) em vez de adicionar
 * `pg` como dependência só pra isso.
 *
 * # Quando remover
 *
 * Pode ser removido depois que todos os ambientes (prod, staging,
 * preview) tiverem rodado pelo menos uma vez com este script ativo.
 */

"use strict";

const { PrismaClient } = require("@prisma/client");

/**
 * Migrations cuja entrada órfã (failed) deve ser removida de
 * `_prisma_migrations` antes de re-rodar. Cada uma tem um motivo
 * e foi corrigida no fonte; só falta limpar o registro de falha.
 */
const FAILED_MIGRATIONS_TO_CLEAN = [
    // Migration original tinha timestamp 20260202_* mas dependia de enum
    // criado em julho 2026; renomeada para 20260735000000_fan_payments.
    "20260202_fan_payments",
    // UPDATE comparava plano_vigente com 'FAN_24H' (label inexistente
    // em base limpa); reescrita com bloco DO/PL-pgSQL idempotente.
    "20260716000000_fan_planos_com_expiracao",
    // Adicionava 'TOPIC_AUDIO' ao enum MediaRole e usava o valor no
    // mesmo arquivo (Postgres exige transações separadas). Dividida
    // em part1 (cria tipos) e part2 (usa).
    "20260726000000_topic_audios",
];

async function main() {
    const prisma = new PrismaClient();
    try {
        // Tabela _prisma_migrations pode não existir num primeiro boot
        // (Prisma cria no primeiro `migrate deploy`). Aborta limpo.
        const tableExists = await prisma.$queryRawUnsafe(
            `SELECT 1 AS ok FROM information_schema.tables
             WHERE table_schema = current_schema()
               AND table_name = '_prisma_migrations'
             LIMIT 1`,
        );
        if (!Array.isArray(tableExists) || tableExists.length === 0) {
            console.log(
                "[cleanup-failed-migration] _prisma_migrations não existe ainda; nada a fazer",
            );
            return;
        }

        const removed = await prisma.$executeRawUnsafe(
            `DELETE FROM _prisma_migrations
             WHERE migration_name = ANY($1::text[])
               AND finished_at IS NULL`,
            FAILED_MIGRATIONS_TO_CLEAN,
        );

        if (removed > 0) {
            console.log(
                `[cleanup-failed-migration] removidas ${removed} entrada(s) órfã(s)`,
            );
        } else {
            console.log(
                `[cleanup-failed-migration] nada a remover (sem entradas órfãs)`,
            );
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error("[cleanup-failed-migration] falha:", err.message ?? err);
    process.exit(1);
});
