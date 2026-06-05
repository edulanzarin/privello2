/**
 * Seed do usuário administrador — Privello.
 *
 * Cria (ou promove) uma conta com `isAdmin = true`, que libera o
 * acesso ao painel `/admin` (moderação de verificações e denúncias).
 *
 * Idempotente: rodar de novo apenas re-confirma a senha, o tipo e a
 * flag de admin — não duplica o usuário (chave por `email`).
 *
 * # Como executar
 *
 * Local:
 *   $ npx tsx prisma/seed-admin.ts
 *
 * Produção (Railway):
 *   $ railway run npx tsx prisma/seed-admin.ts
 *
 * Você pode sobrescrever as credenciais por variáveis de ambiente:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_IDENTIFICADOR, ADMIN_NOME
 *
 * Sem elas, usa os defaults abaixo (a conta solicitada pelo dono).
 */

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/domain/auth/password";
import { normalizarEmail } from "../src/domain/validation/email";
import { normalizarIdentificador } from "../src/domain/validation/identificador";

const prisma = new PrismaClient();

// Credenciais default (sobrescrevíveis por env).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "eduardolanzarin@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Edz#7284@";
const ADMIN_IDENTIFICADOR =
    process.env.ADMIN_IDENTIFICADOR ?? "eduardolanzarin";
const ADMIN_NOME = process.env.ADMIN_NOME ?? "Eduardo Lanzarin";

async function main(): Promise<void> {
    const email = normalizarEmail(ADMIN_EMAIL);
    const identificador = normalizarIdentificador(ADMIN_IDENTIFICADOR);
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    // Upsert por email: cria se não existe, promove a admin se já existe.
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            isAdmin: true,
            passwordHash,
        },
        create: {
            email,
            identificador,
            nome: ADMIN_NOME,
            passwordHash,
            // Admin é uma flag ortogonal ao tipo. CLIENTE é o tipo
            // neutro — não cria perfil de Acompanhante nem expõe o
            // usuário em buscas. O acesso ao /admin vem da flag isAdmin.
            type: "CLIENTE",
            isAdmin: true,
        },
        select: { id: true, email: true, isAdmin: true },
    });

    console.log("✓ Admin configurado:");
    console.log(`  id:      ${user.id}`);
    console.log(`  email:   ${user.email}`);
    console.log(`  isAdmin: ${user.isAdmin}`);
    console.log(`  senha:   (definida — use a que você passou)`);
    console.log("");
    console.log("  Acesse /admin após login.");
}

main()
    .catch((err) => {
        console.error("✗ Falha ao configurar admin:", err);
        process.exit(1);
    })
    .finally(() => {
        void prisma.$disconnect();
    });
