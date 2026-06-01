/**
 * Design tokens compartilhados da Biblioteca_de_Componentes da Privello.
 *
 * Este módulo é a única fonte de verdade para cores, tipografia, espaçamento,
 * raios e efeitos (sombras + blur de vidro). O `tailwind.config.ts` consome
 * estes tokens em `theme.extend`, garantindo consistência entre primitivos
 * e estilos utilitários nas páginas (Requirement 6.6).
 *
 * Direção visual: "Liquid Glass" — superfícies translúcidas com `backdrop
 * filter`, gradientes suaves, raios generosos e animações de spring curtas.
 *
 * Convenções:
 * - Todos os objetos exportados com `as const` para narrowing literal.
 * - Cores tonais (primary, secondary, neutral, success, warning, danger,
 *   info) seguem a escala 50..900 com alias `DEFAULT`.
 * - `glass.*` traz tokens semânticos de vidro (fg, bg, border, shadow) já
 *   prontos para uso em `Card`/`Button ghost` etc.
 */

// -----------------------------------------------------------------------------
// Cores tonais
// -----------------------------------------------------------------------------

const primary = {
    50: "#fff8f5",
    100: "#ffefe8",
    200: "#ffdcce",
    300: "#ffc6b0",
    400: "#ffaa8a",
    500: "#fa9070",
    600: "#ec7b5b",
    700: "#c1614a",
    800: "#934a3b",
    900: "#66332a",
    DEFAULT: "#ffaa8a",
} as const;

const secondary = {
    50: "#fffdf5",
    100: "#fff8e1",
    200: "#ffefb8",
    300: "#ffe38a",
    400: "#ffd45c",
    500: "#ffc233",
    600: "#e0a820",
    700: "#b88a18",
    800: "#906c12",
    900: "#6e530e",
    DEFAULT: "#e0a820",
} as const;

const neutral = {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    DEFAULT: "#6b7280",
} as const;

const success = {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
    DEFAULT: "#16a34a",
} as const;

const warning = {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    DEFAULT: "#d97706",
} as const;

const danger = {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
    DEFAULT: "#dc2626",
} as const;

const info = {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    DEFAULT: "#2563eb",
} as const;

/**
 * Tokens semânticos de vidro (Liquid Glass). São rgba para permitir que o
 * fundo apareça atrás do `backdrop-filter`. Use as variáveis CSS
 * correspondentes (`var(--glass-...)`) em `globals.css` quando precisar
 * misturar dentro de gradientes.
 */
const glass = {
    fg: "rgba(17, 24, 39, 0.92)",
    bgStrong: "rgba(255, 255, 255, 0.72)",
    bg: "rgba(255, 255, 255, 0.55)",
    bgSoft: "rgba(255, 255, 255, 0.35)",
    border: "rgba(255, 255, 255, 0.55)",
    borderStrong: "rgba(17, 24, 39, 0.08)",
    shadow:
        "0 1px 0 0 rgba(255, 255, 255, 0.6) inset, 0 8px 24px -12px rgba(17, 24, 39, 0.18), 0 2px 6px -2px rgba(17, 24, 39, 0.08)",
} as const;

/**
 * Paleta semântica completa.
 *
 * Mapeada para o tema editorial 2026:
 *   - `surface` é o branco puro (cards, modais, inputs).
 *   - `surfaceMuted` é o canvas warm-white de fundo ("paper").
 *   - `background` espelha o canvas pra evitar leak de tokens antigos.
 *   - `border` é o hairline warm sutil.
 *   - `text.primary/secondary/disabled` reproduzem `--ink-1/2/3`.
 *
 * As escalas tonais (primary 100..900 etc.) ficam intactas pra não
 * quebrar componentes que escolheram um tom específico.
 */
export const colors = {
    primary,
    secondary,
    neutral,
    success,
    warning,
    danger,
    info,
    surface: "#ffffff",
    surfaceMuted: "#fbf9f6",
    background: "#fbf9f6",
    border: "rgba(26, 20, 16, 0.08)",
    text: {
        primary: "#1a1410",
        secondary: "#5a4f47",
        disabled: "#968a82",
        inverse: "#ffffff",
    },
    glass,
} as const;

// -----------------------------------------------------------------------------
// Tipografia
// -----------------------------------------------------------------------------

const fontFamily = {
    sans: [
        "Poppins",
        "ui-sans-serif",
        "system-ui",
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "Roboto",
        "Helvetica Neue",
        "Arial",
        "sans-serif",
    ],
    mono: [
        "ui-monospace",
        "SFMono-Regular",
        "Menlo",
        "Monaco",
        "Consolas",
        "Liberation Mono",
        "Courier New",
        "monospace",
    ],
} as const;

const fontSize = {
    xs: { size: "0.75rem", lineHeight: "1rem" },
    sm: { size: "0.875rem", lineHeight: "1.25rem" },
    base: { size: "1rem", lineHeight: "1.5rem" },
    lg: { size: "1.125rem", lineHeight: "1.75rem" },
    xl: { size: "1.25rem", lineHeight: "1.75rem" },
    "2xl": { size: "1.5rem", lineHeight: "2rem" },
    "3xl": { size: "1.875rem", lineHeight: "2.25rem" },
    "4xl": { size: "2.25rem", lineHeight: "2.5rem" },
} as const;

const lineHeight = {
    none: "1",
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2",
} as const;

const fontWeight = {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
} as const;

export const typography = {
    fontFamily,
    fontSize,
    lineHeight,
    fontWeight,
} as const;

// -----------------------------------------------------------------------------
// Espaçamento
// -----------------------------------------------------------------------------

export const spacing = {
    "0": "0rem",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem",
    "12": "3rem",
    "16": "4rem",
    "24": "6rem",
    "32": "8rem",
    "48": "12rem",
    "64": "16rem",
} as const;

// -----------------------------------------------------------------------------
// Raios — escala editorial: cantos arredondados generosos. `2xl/3xl`
// são o sweet spot pra cards grandes.
// -----------------------------------------------------------------------------

export const radius = {
    none: "0rem",
    sm: "0.25rem",   // 4px
    md: "0.5rem",    // 8px
    lg: "0.75rem",   // 12px
    xl: "1rem",      // 16px
    "2xl": "1.25rem", // 20px
    "3xl": "1.5rem",  // 24px
    "4xl": "2rem",   // 32px
    full: "9999px",
} as const;

// -----------------------------------------------------------------------------
// Efeitos: blur de vidro, sombras
// -----------------------------------------------------------------------------

export const blur = {
    xs: "6px",
    sm: "10px",
    md: "16px",
    lg: "24px",
    xl: "40px",
} as const;

export const boxShadow = {
    glass:
        "0 1px 0 0 rgba(255, 255, 255, 0.6) inset, 0 8px 24px -12px rgba(17, 24, 39, 0.18), 0 2px 6px -2px rgba(17, 24, 39, 0.08)",
    glassLg:
        "0 1px 0 0 rgba(255, 255, 255, 0.7) inset, 0 24px 48px -20px rgba(17, 24, 39, 0.28), 0 8px 16px -8px rgba(17, 24, 39, 0.12)",
    glow:
        "0 0 0 6px rgba(124, 58, 237, 0.18), 0 0 0 1px rgba(124, 58, 237, 0.5)",
} as const;

// -----------------------------------------------------------------------------
// Tipos exportados
// -----------------------------------------------------------------------------

export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Blur = typeof blur;
export type BoxShadow = typeof boxShadow;

export const tokens = {
    colors,
    typography,
    spacing,
    radius,
    blur,
    boxShadow,
} as const;

export type Tokens = typeof tokens;
