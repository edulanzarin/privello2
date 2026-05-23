import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: {
        default: "Privello",
        template: "%s · Privello",
    },
    description: "Privello — encontros que começam com você no controle.",
    icons: {
        icon: "/icon.png",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR" className={inter.variable}>
            <body className="min-h-screen font-sans">{children}</body>
        </html>
    );
}
