#!/usr/bin/env node
/* eslint-disable */
/**
 * One-shot: limpa entrada órfã da migration `20260202_fan_payments`
 * em `_prisma_migrations` no Postgres.
 *
 * # Por quê
 *
 * A migration original tinha timestamp `20260202_*` mas dependia do
 * enum `BoostPaymentStatus`, criado pela migration de julho 2026.
 * Em ordenação por timestamp, o `migrate deploy` aplicava `fan_payments`
 * antes do enum existir e abortava, deixando a entrada `failed` em
 * `_prisma_migrations`. A migration foi renomeada pra timestamp
 * `20260735000000_*` (depois do enum existir), mas a entrada falhada
 * antiga ainda bloqueia o `migrate deploy` com P3009.
 *
 * Este script remove a entrada antiga (idempotente: se não existir,
 * sai 0). Roda no boot do container, antes do `migrate deploy`.
 *
 * É seguro: a tabela `fan_payments` nunca foi criada (a migration
 * abortou antes), então não há schema corrompido. Apenas limpamos o
 * registro de tentativa falhada.
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

const OLD_MIGRATION_NAME = "20260202_fan_payments";

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
             WHERE migration_name = $1
               AND finished_at IS NULL`,
            OLD_MIGRATION_NAME,
        );

        if (removed > 0) {
            console.log(
                `[cleanup-failed-migration] removida entrada órfã de ${OLD_MIGRATION_NAME} (${removed} linha)`,
            );
        } else {
            console.log(
                `[cleanup-failed-migration] nada a remover (entrada órfã não encontrada)`,
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
