import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma Client used by every server-side module of the Privello
 * platform (`src/server/**`, route handlers, server actions and server
 * components).
 *
 * In development Next.js performs hot-reloads which can otherwise create one
 * `PrismaClient` per HMR cycle and exhaust the database connection pool. To
 * avoid this we cache the instance on `globalThis` outside of production.
 *
 * No application code should instantiate `PrismaClient` directly: import the
 * `db` export from this module instead.
 */
declare global {
    // eslint-disable-next-line no-var
    var __privelloPrisma: PrismaClient | undefined;
}

export const db: PrismaClient =
    globalThis.__privelloPrisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === "development"
                ? ["query", "error", "warn"]
                : ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalThis.__privelloPrisma = db;
}

export default db;
