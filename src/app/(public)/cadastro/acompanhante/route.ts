/**
 * `GET /cadastro/acompanhante` — entrada do Sistema_de_Onboarding.
 *
 * Inicia um novo `OnboardingDraft` via {@link iniciar}, define o cookie
 * opaco `onboardingId` (HttpOnly + SameSite=Lax) usando o helper
 * canônico {@link serializeOnboardingCookie} do serviço de drafts e
 * redireciona o navegador para o primeiro passo (`/cadastro/acompanhante/1`).
 *
 * # Por que um Route Handler em vez de um Server Component?
 *
 * O Next.js 15 só permite gravar cookies a partir de Server Actions e
 * Route Handlers — Server Components não conseguem chamar `cookies().set`.
 * Para preservar o contrato do design (Sistema_de_Onboarding cria o
 * draft no servidor e envia o cookie *na mesma resposta* que leva o
 * navegador para o passo 1), usamos um `route.ts` que monta uma
 * `Response` com `Location` + `Set-Cookie` em uma única ida ao
 * servidor. O efeito observável é idêntico ao de um Server Component
 * que chama `redirect`.
 *
 * # Idempotência
 *
 * Cada acesso a esta rota cria um draft novo. Isso é intencional:
 * permite que a mesma máquina inicie várias tentativas (por exemplo,
 * em abas diferentes), e o draft anterior é descartado naturalmente
 * pelo TTL de 60 minutos (Requirement 3.3). Drafts órfãos com
 * `staged/` correspondentes são reaproveitados pela limpeza periódica
 * (task 11.9).
 *
 * Validates: Requirements 3.1, 3.2.
 */

import {
    iniciar,
    serializeOnboardingCookie,
} from "@/server/onboarding";

/** Caminho do primeiro passo do fluxo de onboarding. */
const PRIMEIRO_PASSO_PATH = "/cadastro/acompanhante/1";

export async function GET(): Promise<Response> {
    const { onboardingId } = await iniciar();

    // Location relativo: o browser resolve usando o Host da request
    // atual. Evita o bug de URL absoluta com `request.url` quando o
    // app roda atrás de proxy (Railway, Cloudflare etc.), em que
    // `request.url` é o endereço interno (`http://0.0.0.0:8080/...`),
    // não o domínio público.
    return new Response(null, {
        status: 303,
        headers: {
            Location: PRIMEIRO_PASSO_PATH,
            "Set-Cookie": serializeOnboardingCookie(onboardingId),
            // Evita que o navegador/CDN cache uma resposta que cria um
            // recurso novo a cada hit.
            "Cache-Control": "no-store",
        },
    });
}
