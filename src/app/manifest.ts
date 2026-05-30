import type { MetadataRoute } from "next";

/**
 * Web App Manifest gerado pelo Next.
 *
 * Habilita "Adicionar à tela inicial" em mobile e melhora cards
 * de pesquisa em alguns navegadores. Basta o mínimo — não tem
 * service worker ainda (PWA completo é pós-MVP).
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Privello",
        short_name: "Privello",
        description:
            "Acompanhantes verificadas no Brasil. Perfis com fotos, áudio e avaliações.",
        start_url: "/",
        display: "standalone",
        background_color: "#fbf9f6",
        theme_color: "#ec7b5b",
        orientation: "portrait",
        lang: "pt-BR",
        icons: [
            {
                src: "/icon.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icon.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icon.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
        categories: ["lifestyle", "social"],
    };
}
