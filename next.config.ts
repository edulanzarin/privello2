import type { NextConfig } from "next";

import { validateEnv } from "./src/lib/env";

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

const nextConfig: NextConfig = {
    reactStrictMode: true,
    output: "standalone",
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
            isProd
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "connect-src 'self' https://servicodados.ibge.gov.br https://overpass-api.de https://nominatim.openstreetmap.org",
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
                value: "geolocation=(), camera=(), microphone=(self), payment=()",
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
