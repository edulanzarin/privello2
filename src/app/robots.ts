import type { MetadataRoute } from "next";

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * `robots.txt` dinâmico — gerado pelo Next.
 *
 * Permite indexação geral mas bloqueia áreas privadas e endpoints
 * de API que não fazem sentido no SERP. O `sitemap` aponta pra
 * `/sitemap.xml` (gerado por `src/app/sitemap.ts`).
 *
 * Em **dev** ou ambientes não-produção, bloqueia tudo — evita que
 * staging vaze pro Google.
 */
export default function robots(): MetadataRoute.Robots {
    if (process.env.NODE_ENV !== "production") {
        return {
            rules: { userAgent: "*", disallow: "/" },
            sitemap: `${SITE_URL}/sitemap.xml`,
        };
    }

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/api/",
                    "/admin",
                    "/admin/",
                    "/cliente",
                    "/cliente/",
                    "/acompanhante",
                    "/acompanhante/",
                    "/cadastro/acompanhante/",
                    "/cadastro/cliente",
                    "/recuperar-senha",
                    "/redefinir-senha",
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
