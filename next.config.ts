import type { NextConfig } from "next";

import { validateEnv } from "./src/lib/env";
import { devAllowedOrigins } from "./src/lib/lanHosts";

// Valida as variáveis de ambiente o mais cedo possível no boot do Next.js.
// Em `next build` (em CI) e `next start` (em runtime), este módulo é avaliado
// antes de qualquer rota ser servida. Em caso de falha, `validateEnv` lança
// `EnvValidationError`, abortando o processo com código diferente de zero
// (Requirements 7.5, 7.7, 7.8).
//
// Pulamos a validação durante `next lint` ou execução de testes, onde o
// objetivo não é levantar o servidor — esses contextos definem
// `SKIP_ENV_VALIDATION=1` explicitamente.
if (process.env.SKIP_ENV_VALIDATION !== "1") {
    validateEnv();
}

// Origens de dev confiáveis (LAN). Permite acessar de qualquer
// dispositivo da rede via `http://192.168.x.y:PORT` sem o Next
// bloquear Server Actions (que validam Origin vs Host) nem emitir
// o aviso de cross-origin. Auto-detecta os IPs da máquina; pode
// estender via env `DEV_ALLOWED_HOSTS` (CSV).
const ALLOWED_ORIGINS = devAllowedOrigins();

const nextConfig: NextConfig = {
    reactStrictMode: true,
    output: "standalone",
    // Reconhece as origens da LAN no dev (Next 15.5+). Sem isso, o
    // dev server avisa/bloqueia requests vindas de outro IP.
    allowedDevOrigins: ALLOWED_ORIGINS,
    // Mantém `sharp` e `ffmpeg-static` como dependências externas em
    // vez de empacotá-las pelo webpack. `sharp` carrega .node nativo
    // e `ffmpeg-static` resolve o caminho do binário via __dirname,
    // que o bundler quebra. Em runtime ambos serão carregados de
    // `node_modules` direto. O Next em standalone copia o que é
    // necessário automaticamente.
    serverExternalPackages: ["sharp", "ffmpeg-static"],
    experimental: {
        serverActions: {
            bodySizeLimit: "64mb",
            // Permite Server Actions (cadastro, onboarding) quando o
            // app é acessado via IP da LAN — senão o Next rejeita por
            // mismatch de Origin/Host.
            allowedOrigins: ALLOWED_ORIGINS,
        },
    },
    /**
     * Headers de segurança aplicados a todas as rotas. Defesa em
     * profundidade — nada aqui é negociado durante o request, é só
     * configuração.
     *
     * - **CSP**: política restritiva. Permite assets do próprio
     *   domínio + `data:` para imagens (avatar fallbacks) +
     *   imagens do R2 (em produção, `R2_PUBLIC_BASE_URL`) +
     *   blob: para previews locais de upload. Inline scripts e
     *   `eval` são proibidos. Em dev permitimos `unsafe-eval` pra
     *   o HMR do Next.js funcionar.
     * - **X-Frame-Options: DENY**: nada de iframe externo.
     * - **X-Content-Type-Options: nosniff**: navegador respeita o
     *   `Content-Type` declarado.
     * - **Referrer-Policy: strict-origin-when-cross-origin**:
     *   não vaza paths do site para outros domínios.
     * - **Permissions-Policy**: bloqueia geolocation, camera, mic,
     *   payment etc. por padrão. A Acompanhante grava áudio via
     *   `getUserMedia(audio)` — então `microphone=(self)` é
     *   permitido.
     * - **Strict-Transport-Security**: só faz sentido em produção
     *   (HTTPS). Adicionado condicional.
     */
    async headers() {
        const isProd = process.env.NODE_ENV === "production";

        const r2Origin = process.env.R2_PUBLIC_BASE_URL ?? "";
        const imgSources = ["'self'", "data:", "blob:"];
        if (r2Origin.length > 0) {
            try {
                const url = new URL(r2Origin);
                imgSources.push(`${url.protocol}//${url.host}`);
            } catch {
                // ignora env inválido — outras checagens pegam
            }
        }
        // Permite imagens do picsum (usado pelo seed em dev).
        if (!isProd) {
            imgSources.push("https://picsum.photos");
            imgSources.push("https://fastly.picsum.photos");
        }
        // Tiles raster do OpenStreetMap pro mapa interativo da busca
        // (T14, Maplibre GL). Sem token — endpoint público do OSM.
        const osmTiles = [
            "https://tile.openstreetmap.org",
            "https://a.tile.openstreetmap.org",
            "https://b.tile.openstreetmap.org",
            "https://c.tile.openstreetmap.org",
        ];
        imgSources.push(...osmTiles);

        const csp = [
            "default-src 'self'",
            `img-src ${imgSources.join(" ")}`,
            "media-src 'self' blob:",
            "font-src 'self' data:",
            // 'unsafe-inline' em style-src é necessário porque o
            // Tailwind injeta classes inline; sem isso quebra a
            // página inteira. Mitigação: tudo é gerado em build.
            "style-src 'self' 'unsafe-inline'",
            // 'unsafe-inline' em script-src também — Next.js usa
            // inline pra hidratação. 'unsafe-eval' só em dev pro HMR.
            // Stripe.js é carregado de js.stripe.com (necessário pra
            // Payment Element / redirect ao Checkout hospedado).
            isProd
                ? "script-src 'self' 'unsafe-inline' https://js.stripe.com"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
            // Maplibre GL roda render num Web Worker carregado de
            // blob: — `worker-src` precisa permitir blob: senão o
            // mapa não inicializa.
            "worker-src 'self' blob:",
            `connect-src 'self' https://api.stripe.com https://servicodados.ibge.gov.br https://overpass-api.de https://nominatim.openstreetmap.org ${osmTiles.join(" ")}`,
            // Stripe injeta iframes (js.stripe.com / hooks.stripe.com)
            // pra 3D Secure e elementos de pagamento embarcados.
            "frame-src https://js.stripe.com https://hooks.stripe.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join("; ");

        const headers: Array<{ key: string; value: string }> = [
            { key: "Content-Security-Policy", value: csp },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            {
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin",
            },
            {
                key: "Permissions-Policy",
                value: "geolocation=(), camera=(), microphone=(self), payment=(self)",
            },
        ];

        if (isProd) {
            headers.push({
                key: "Strict-Transport-Security",
                value: "max-age=63072000; includeSubDomains; preload",
            });
        }

        return [
            {
                source: "/:path*",
                headers,
            },
        ];
    },
};

export default nextConfig;
