import type { Config } from "tailwindcss";

import {
    blur,
    boxShadow,
    colors,
    radius,
    spacing,
    typography,
} from "./src/components/tokens";

/**
 * Mapeia a escala `fontSize` (que combina tamanho + line-height) para o
 * formato esperado pelo Tailwind (`[size, { lineHeight }]`).
 */
const fontSize = Object.fromEntries(
    Object.entries(typography.fontSize).map(([key, value]) => [
        key,
        [value.size, { lineHeight: value.lineHeight }],
    ]),
) as Record<
    keyof typeof typography.fontSize,
    [string, { lineHeight: string }]
>;

const config: Config = {
    content: [
        "./src/app/**/*.{ts,tsx}",
        "./src/components/**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: colors.primary,
                secondary: colors.secondary,
                neutral: colors.neutral,
                success: colors.success,
                warning: colors.warning,
                danger: colors.danger,
                info: colors.info,
                surface: colors.surface,
                "surface-muted": colors.surfaceMuted,
                background: colors.background,
                border: colors.border,
                text: colors.text,
                glass: colors.glass,
                // Accent warm da marca, registrado como cor Tailwind
                // pra habilitar utilitários com opacidade (`accent/40`,
                // `bg-accent-soft`) em vez de hex arbitrário
                // (`[#ec7b5b]/40`). Hex fixos espelham as CSS vars
                // `--accent*` em globals.css — manter em sincronia.
                accent: {
                    DEFAULT: "#ec7b5b",
                    deep: "#c5523a",
                    soft: "#fff0eb",
                },
            },
            fontFamily: {
                sans: ["var(--font-sans)", ...typography.fontFamily.sans],
                mono: [...typography.fontFamily.mono],
            },
            fontSize,
            lineHeight: { ...typography.lineHeight },
            fontWeight: { ...typography.fontWeight },
            spacing: { ...spacing },
            borderRadius: { ...radius },
            backdropBlur: { ...blur },
            boxShadow: { ...boxShadow },
            keyframes: {
                "fade-in": {
                    "0%": {
                        opacity: "0",
                        transform: "translateY(8px) scale(0.98)",
                    },
                    "100%": {
                        opacity: "1",
                        transform: "translateY(0) scale(1)",
                    },
                },
                "fade-in-soft": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                "pop": {
                    "0%": { transform: "scale(1)" },
                    "30%": { transform: "scale(1.25)" },
                    "60%": { transform: "scale(0.92)" },
                    "100%": { transform: "scale(1)" },
                },
                "shimmer": {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                "skeleton-shimmer": {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
                "blob-1": {
                    "0%, 100%": {
                        transform: "translate(0, 0) scale(1)",
                    },
                    "33%": {
                        transform: "translate(30px, -50px) scale(1.1)",
                    },
                    "66%": {
                        transform: "translate(-20px, 20px) scale(0.9)",
                    },
                },
                "blob-2": {
                    "0%, 100%": {
                        transform: "translate(0, 0) scale(1)",
                    },
                    "33%": {
                        transform: "translate(-40px, 40px) scale(1.15)",
                    },
                    "66%": {
                        transform: "translate(20px, -30px) scale(0.85)",
                    },
                },
                "slide-up": {
                    "0%": {
                        opacity: "0",
                        transform: "translateY(16px)",
                    },
                    "100%": {
                        opacity: "1",
                        transform: "translateY(0)",
                    },
                },
            },
            animation: {
                "fade-in": "fade-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
                "fade-in-soft": "fade-in-soft 200ms ease-out both",
                "pop": "pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                "shimmer": "shimmer 2.4s linear infinite",
                "skeleton-shimmer": "skeleton-shimmer 1.4s linear infinite",
                "blob-1": "blob-1 18s ease-in-out infinite",
                "blob-2": "blob-2 22s ease-in-out infinite",
                "slide-up": "slide-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
            },
            transitionTimingFunction: {
                spring: "cubic-bezier(0.16, 1, 0.3, 1)",
            },
        },
    },
    plugins: [],
};

export default config;
