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
            // Server Actions têm limite default de 1 MB. Os limites
            // canônicos de upload da Privello (foto 8 MB, capa 8 MB,
            // vídeo da galeria 50 MB) somados ao overhead de
            // multipart pedem um teto generoso. 64 MB cobre vídeos
            // com folga e não muda nada em runtime quando o caller
            // só manda foto pequena. Endpoints dedicados em
            // `/api/...` (galeria, foto/capa pós-cadastro, áudio)
            // já bypassam Server Actions e não dependem desse
            // limite — ele só importa para o `uploadFotoAction` do
            // onboarding.
            bodySizeLimit: "64mb",
        },
    },
};

export default nextConfig;
