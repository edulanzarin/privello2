import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { cidadeLandingPath } from "@/domain/busca/citySlug";

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * `sitemap.xml` dinâmico.
 *
 * Inclui:
 *   - **Páginas estáticas**: `/`, `/acompanhantes`, `/login`,
 *     `/cadastro`, `/cadastro/cliente`.
 *   - **Páginas de busca por cidade**: gera uma URL por
 *     `(cidade, UF)` distinta de Acompanhante visível.
 *   - **Perfis públicos**: cada `/acompanhantes/<slug>` visível
 *     com plano vigente.
 *
 * O Next limita sitemap a 50.000 URLs por arquivo. Caso a
 * plataforma cresça além disso, fragmentar em sitemap por UF.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    // Páginas estáticas — alta prioridade nas que realmente
    // queremos no SERP.
    const staticEntries: MetadataRoute.Sitemap = [
        {
            url: `${SITE_URL}/`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${SITE_URL}/acompanhantes`,
            lastModified: now,
            changeFrequency: "hourly",
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/login`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.3,
        },
        {
            url: `${SITE_URL}/cadastro`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.5,
        },
    ];

    // Perfis e cidades só fazem sentido em produção (ou seed
    // local com dados reais). Em build sem DB, retorna estáticos.
    let perfilEntries: MetadataRoute.Sitemap = [];
    let cidadeEntries: MetadataRoute.Sitemap = [];

    try {
        // Perfis visíveis com plano vigente.
        const perfis = await db.acompanhanteProfile.findMany({
            where: {
                perfilVisivel: true,
                planoVigente: { not: null },
                user: { type: "ACOMPANHANTE" },
            },
            select: {
                user: { select: { identificador: true } },
                updatedAt: true,
                cidadeNome: true,
                estadoSigla: true,
                boostUntil: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 40_000, // teto saudável; resto cai no segundo arquivo no futuro
        });

        perfilEntries = perfis.map((p) => ({
            url: `${SITE_URL}/acompanhantes/${p.user.identificador}`,
            lastModified: p.updatedAt,
            changeFrequency: "weekly" as const,
            // Boost ativo ganha priority maior.
            priority:
                p.boostUntil !== null && p.boostUntil.getTime() > now.getTime()
                    ? 0.9
                    : 0.7,
        }));

        // Pares (cidade, UF) distintos — uma URL de busca por par.
        const pares = new Set<string>();
        for (const p of perfis) {
            pares.add(`${p.cidadeNome}|${p.estadoSigla}`);
        }
        cidadeEntries = Array.from(pares)
            .slice(0, 5_000)
            .flatMap((par) => {
                const [cidade, uf] = par.split("|");
                const params = new URLSearchParams();
                params.set("cidade", cidade!);
                params.set("uf", uf!);
                return [
                    // Landing estática (ISR) — alvo principal de SEO.
                    {
                        url: `${SITE_URL}${cidadeLandingPath(cidade!, uf!)}`,
                        lastModified: now,
                        changeFrequency: "daily" as const,
                        priority: 0.7,
                    },
                    // Busca filtrável (querystring) — secundária.
                    {
                        url: `${SITE_URL}/acompanhantes?${params.toString()}`,
                        lastModified: now,
                        changeFrequency: "daily" as const,
                        priority: 0.6,
                    },
                ];
            });
    } catch {
        // DB indisponível em build (ex.: CI sem container) —
        // emite sitemap estático e segue.
    }

    return [...staticEntries, ...cidadeEntries, ...perfilEntries];
}
