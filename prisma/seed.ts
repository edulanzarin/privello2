/**
 * Seed de desenvolvimento — Privello.
 *
 * Cria uma única conta de Acompanhante para destravar testes manuais
 * sem precisar passar pelo onboarding inteiro:
 *
 * | Tipo         | Email                  | Senha       | Plano  |
 * | ------------ | ---------------------- | ----------- | ------ |
 * | ACOMPANHANTE | juliasantos@gmail.com  | Edz#7284    | BASICO |
 *
 * Comportamento:
 *   - Idempotente. Re-rodar o seed apenas regrava o `passwordHash` e
 *     re-confirma os atributos do perfil. Linhas pré-existentes não
 *     são duplicadas.
 *   - Apaga sessões e tentativas de login antigas para que o rate
 *     limit por email (Requirement 1.8) e cookies persistidos no
 *     browser não confundam o teste.
 *   - Já vem com plano BASICO selecionado (Requirement 5.10) +
 *     telefone, localidade, gênero, valor da hora, formas de
 *     pagamento, dias da semana e demais campos populados com
 *     valores plausíveis pra que o perfil renderize completo.
 *
 * Como executar:
 *   $ npx prisma db seed
 * (com `prisma.seed` configurado em `package.json`)
 *
 * Ou diretamente:
 *   $ npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/domain/auth/password";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Edz#7284";

const ACOMPANHANTE = {
    email: "juliasantos@gmail.com",
    identificador: "juliasantos",
    nome: "Julia Santos",
    telefone: "11987654321",
    estadoSigla: "SP",
    cidadeNome: "São Paulo",
    bairroNome: "Moema",
    descricao:
        "Olá! Sou a Julia, atendo na zona sul de São Paulo. Buscando momentos discretos e prazerosos. Combine pelo WhatsApp.",
    valorHoraCents: 30_000, // R$ 300,00
};

async function main(): Promise<void> {
    const passwordHash = await hashPassword(SEED_PASSWORD);
    const now = new Date();

    // -----------------------------------------------------------------
    // Acompanhante (com plano BASICO + perfil completo)
    // -----------------------------------------------------------------
    const acompanhante = await prisma.user.upsert({
        where: { email: ACOMPANHANTE.email },
        update: {
            passwordHash,
            identificador: ACOMPANHANTE.identificador,
            nome: ACOMPANHANTE.nome,
            type: "ACOMPANHANTE",
        },
        create: {
            email: ACOMPANHANTE.email,
            identificador: ACOMPANHANTE.identificador,
            nome: ACOMPANHANTE.nome,
            passwordHash,
            type: "ACOMPANHANTE",
        },
        select: { id: true },
    });

    // Upsert do AcompanhanteProfile. Concentra todos os campos pra
    // que o perfil público renderize todas as seções (aparência,
    // atendimento, valores, etc) sem precisar editar manualmente.
    await prisma.acompanhanteProfile.upsert({
        where: { userId: acompanhante.id },
        update: {
            telefone: ACOMPANHANTE.telefone,
            estadoSigla: ACOMPANHANTE.estadoSigla,
            cidadeNome: ACOMPANHANTE.cidadeNome,
            bairroNome: ACOMPANHANTE.bairroNome,
            descricao: ACOMPANHANTE.descricao,
            planoVigente: "BASICO",
            planoSelecionadoEm: now,
            perfilVisivel: true,
            // Identidade e atendimento
            genero: "MULHER",
            atendePublicos: ["HOMEM", "CASAL"],
            realizaPraticas: ["ORAL", "VAGINAL", "BEIJO_NA_BOCA", "MASSAGEM"],
            // Aparência
            pesoKg: 61,
            alturaCm: 166,
            tamanhoPe: 36,
            etnia: "BRANCA",
            corOlhos: "PRETO",
            estiloCabelo: "LISO",
            tamanhoCabelo: "LONGO",
            temSilicone: false,
            temTatuagens: true,
            temPiercing: true,
            fumante: false,
            idiomas: ["PORTUGUES"],
            // Atendimento comercial
            valorHoraCents: ACOMPANHANTE.valorHoraCents,
            formasPagamento: ["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO"],
            diasAtende: ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"],
        },
        create: {
            userId: acompanhante.id,
            telefone: ACOMPANHANTE.telefone,
            estadoSigla: ACOMPANHANTE.estadoSigla,
            cidadeNome: ACOMPANHANTE.cidadeNome,
            bairroNome: ACOMPANHANTE.bairroNome,
            descricao: ACOMPANHANTE.descricao,
            planoVigente: "BASICO",
            planoSelecionadoEm: now,
            perfilVisivel: true,
            genero: "MULHER",
            atendePublicos: ["HOMEM", "CASAL"],
            realizaPraticas: ["ORAL", "VAGINAL", "BEIJO_NA_BOCA", "MASSAGEM"],
            pesoKg: 61,
            alturaCm: 166,
            tamanhoPe: 36,
            etnia: "BRANCA",
            corOlhos: "PRETO",
            estiloCabelo: "LISO",
            tamanhoCabelo: "LONGO",
            temSilicone: false,
            temTatuagens: true,
            temPiercing: true,
            fumante: false,
            idiomas: ["PORTUGUES"],
            valorHoraCents: ACOMPANHANTE.valorHoraCents,
            formasPagamento: ["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO"],
            diasAtende: ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"],
        },
    });

    // -----------------------------------------------------------------
    // Limpeza de sessões e tentativas de login antigas
    // -----------------------------------------------------------------
    await prisma.session.deleteMany({
        where: { userId: acompanhante.id },
    });
    await prisma.loginAttempt.deleteMany({
        where: { email: ACOMPANHANTE.email },
    });

    // eslint-disable-next-line no-console
    console.log("✓ Seed concluído.");
    // eslint-disable-next-line no-console
    console.log(
        `  Acompanhante: ${ACOMPANHANTE.email} / ${SEED_PASSWORD}  (@${ACOMPANHANTE.identificador})`,
    );
}

main()
    .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("✗ Seed falhou:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
