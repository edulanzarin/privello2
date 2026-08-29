import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Inter } from "next/font/google";
import "./globals.css";

import { ToastProvider } from "@/components";

import { PwaBootstrap } from "./_pwa/PwaBootstrap";

/**
 * Duas famílias, dois papéis, e o contraste entre elas É a identidade.
 *
 * `Bodoni Moda` no display: serifada de altíssimo contraste, o registro de
 * capa de revista de moda. É ela que faz a tela ler como sensual sem precisar
 * de nenhum ornamento.
 *
 * `Inter` no corpo: grótesca neutra, some do caminho e deixa o título e a foto
 * falarem. A saída da Poppins foi deliberada: bojo perfeitamente circular
 * desenhado para parecer amigável, que é o oposto do que este site quer dizer.
 */
const display = Bodoni_Moda({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-display",
    display: "swap",
});

const corpo = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
});

/**
 * URL canônica do site, usada como `metadataBase` (Next normaliza
 * URLs relativas em metadata pra absolutas) e como base pro
 * sitemap. Em prod definir via `NEXT_PUBLIC_SITE_URL`.
 */
const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Metadata global da Privello.
 *
 * Configurada pra maximizar visibilidade em buscadores:
 *
 * - **title** com template (`{page} · Privello`) — cada página
 *   define o próprio prefixo via `generateMetadata`.
 * - **description** com palavras-chave que importam pro produto
 *   (acompanhantes, encontros, cidades brasileiras).
 * - **keywords** opcionais — Google ignora há anos, mas Bing/
 *   Yandex ainda usam.
 * - **openGraph** + **twitter** pra cards bonitos quando o link
 *   for compartilhado em redes/WhatsApp/etc.
 * - **robots** liberado pra indexação. Páginas autenticadas
 *   marcadas como `noindex` no header CSP/robots.txt.
 * - **alternates.canonical** força o domínio canônico.
 * - **manifest** apontado pra `/manifest.webmanifest` (PWA-ready).
 */
export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: "Privello — Acompanhantes verificadas no Brasil",
        template: "%s · Privello",
    },
    description:
        "Encontre acompanhantes verificadas no Brasil. Perfis com fotos, vídeos, áudio e avaliações reais. Privacidade, transparência e contato direto pelo WhatsApp.",
    keywords: [
        "acompanhantes",
        "garotas de programa",
        "encontros",
        "acompanhantes Brasil",
        "acompanhantes verificadas",
        "garotas",
        "Privello",
    ],
    applicationName: "Privello",
    authors: [{ name: "Privello" }],
    creator: "Privello",
    publisher: "Privello",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    icons: {
        icon: "/icon.png",
        apple: "/icon.png",
    },
    manifest: "/manifest.webmanifest",
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        locale: "pt_BR",
        url: SITE_URL,
        siteName: "Privello",
        title: "Privello — Acompanhantes verificadas no Brasil",
        description:
            "Encontre acompanhantes verificadas no Brasil. Perfis com fotos, vídeos, áudio e avaliações reais.",
        images: [
            {
                url: "/icon.png",
                width: 512,
                height: 512,
                alt: "Privello",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Privello — Acompanhantes verificadas no Brasil",
        description:
            "Encontre acompanhantes verificadas no Brasil. Perfis completos, áudio e avaliações.",
        images: ["/icon.png"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
        },
    },
    /**
     * Verificação de propriedade nos webmaster tools.
     *
     * Cada plataforma fornece um código que pode ser inserido como
     * meta tag (alternativa ao registro DNS TXT). Preenchemos via
     * env vars pra não vazar códigos no repo público.
     *
     * - `GOOGLE_SITE_VERIFICATION`: code do Google Search Console.
     * - `BING_SITE_VERIFICATION`: code do Bing Webmaster Tools.
     * - `YANDEX_VERIFICATION`: opcional, pra mercados russos (~0%).
     *
     * Sem env definida, o campo correspondente é omitido.
     */
    verification: {
        google: process.env.GOOGLE_SITE_VERIFICATION,
        other: process.env.BING_SITE_VERIFICATION
            ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
            : undefined,
    },
    category: "lifestyle",
};

/**
 * Viewport otimizado pra mobile. `interactiveWidget: resizes-content`
 * deixa o teclado virtual empurrar o conteúdo (vs. cobrir).
 */
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#fbf9f6" },
        { media: "(prefers-color-scheme: dark)", color: "#1a1410" },
    ],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR" className={`${corpo.variable} ${display.variable}`}>
            <body className="min-h-screen font-sans">
                <OrganizationJsonLd />
                <ToastProvider>{children}</ToastProvider>
                <PwaBootstrap />
            </body>
        </html>
    );
}

/**
 * JSON-LD `Organization` — ajuda o Google a entender quem é a marca
 * (vira knowledge panel quando consolidado). Renderizado uma vez
 * no root.
 */
function OrganizationJsonLd(): React.ReactElement {
    const data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Privello",
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        description:
            "Plataforma brasileira de acompanhantes verificadas. Perfis completos com fotos, vídeos e avaliações.",
        sameAs: [],
    };
    return (
        <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
