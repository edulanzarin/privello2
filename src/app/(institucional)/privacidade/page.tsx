import type { Metadata } from "next";
import Link from "next/link";

import { PageSurface } from "@/components";

export const metadata: Metadata = {
    title: "Política de Privacidade",
    description:
        "Como a Privello coleta, usa e protege seus dados pessoais. Política em conformidade com a LGPD (Lei Geral de Proteção de Dados).",
    alternates: { canonical: "/privacidade" },
};

const ULTIMA_REVISAO = "5 de junho de 2026";

export default function PrivacidadePage() {
    return (
        <PageSurface>
            <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                <header className="mb-8">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-accent-deep">
                        Documento legal
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                        Política de Privacidade
                    </h1>
                    <p className="mt-3 text-sm text-text-secondary">
                        Última revisão: {ULTIMA_REVISAO}
                    </p>
                </header>

                <div className="space-y-8 text-sm leading-relaxed text-text-primary">
                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            1. Quem somos
                        </h2>
                        <p className="text-text-secondary">
                            A Privello (privello.com.br) é uma plataforma
                            brasileira que conecta acompanhantes a clientes.
                            Esta Política descreve como tratamos seus dados
                            pessoais, em conformidade com a Lei Geral de
                            Proteção de Dados (LGPD — Lei 13.709/2018).
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            2. Dados que coletamos
                        </h2>
                        <p className="mb-2 text-text-secondary">
                            Coletamos apenas o necessário para operar a
                            plataforma:
                        </p>
                        <ul className="ml-5 list-disc space-y-1 text-text-secondary">
                            <li>
                                <strong>Cadastro:</strong> nome, email, nome de
                                usuário, senha (hash), tipo de conta.
                            </li>
                            <li>
                                <strong>Perfil de Acompanhante:</strong>{" "}
                                telefone, cidade, descrição, fotos, vídeos,
                                áudios, características (voluntárias).
                            </li>
                            <li>
                                <strong>Verificação:</strong> documento e
                                selfie (apenas quando você solicita
                                verificação).
                            </li>
                            <li>
                                <strong>Pagamento:</strong> dados do cartão são
                                processados pela Stripe — não armazenamos número
                                de cartão.
                            </li>
                            <li>
                                <strong>Uso:</strong> visualizações de perfil,
                                cliques no WhatsApp (anônimos, agregados),
                                histórico de buscas salvas (Cliente).
                            </li>
                            <li>
                                <strong>Técnicos:</strong> IP, user-agent,
                                cookies de sessão (HttpOnly).
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            3. Por que coletamos (bases legais)
                        </h2>
                        <ul className="ml-5 list-disc space-y-1 text-text-secondary">
                            <li>
                                <strong>Execução de contrato:</strong> operar a
                                conta, processar pagamentos, exibir perfis.
                            </li>
                            <li>
                                <strong>Consentimento:</strong> verificação de
                                identidade (você opta), notificações por email
                                (futuro).
                            </li>
                            <li>
                                <strong>Legítimo interesse:</strong> prevenir
                                fraude, moderar conteúdo, proteger usuários.
                            </li>
                            <li>
                                <strong>Cumprimento legal:</strong> reter
                                determinados dados quando exigido por lei.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            4. Compartilhamento
                        </h2>
                        <p className="mb-2 text-text-secondary">
                            Compartilhamos dados apenas com:
                        </p>
                        <ul className="ml-5 list-disc space-y-1 text-text-secondary">
                            <li>
                                <strong>Stripe</strong> — processamento de
                                pagamentos (https://stripe.com/br/privacy).
                            </li>
                            <li>
                                <strong>Cloudflare R2</strong> — armazenamento
                                de mídia (fotos, vídeos, áudios).
                            </li>
                            <li>
                                <strong>Railway</strong> — hospedagem da
                                aplicação e banco de dados.
                            </li>
                            <li>
                                <strong>Autoridades</strong> — apenas mediante
                                ordem judicial ou requisição legal válida.
                            </li>
                        </ul>
                        <p className="mt-2 text-text-secondary">
                            <strong>Não vendemos dados.</strong> Não fazemos
                            marketing pra terceiros. Os perfis de acompanhantes
                            são públicos por natureza, mas dados de Cliente são
                            privados.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            5. Segurança
                        </h2>
                        <ul className="ml-5 list-disc space-y-1 text-text-secondary">
                            <li>
                                Senhas armazenadas com hash Argon2id (estado da
                                arte).
                            </li>
                            <li>
                                Cookies de sessão com flag HttpOnly +
                                SameSite=Lax + assinatura HMAC.
                            </li>
                            <li>
                                Proteção CSRF em todos os endpoints de mutação.
                            </li>
                            <li>HTTPS forçado em produção.</li>
                            <li>
                                Documentos de verificação em armazenamento
                                privado, acessíveis apenas a moderadores.
                            </li>
                            <li>
                                Headers de segurança (CSP, X-Frame-Options,
                                Strict-Transport-Security).
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            6. Seus direitos (LGPD)
                        </h2>
                        <p className="mb-2 text-text-secondary">
                            Você pode, a qualquer momento:
                        </p>
                        <ul className="ml-5 list-disc space-y-1 text-text-secondary">
                            <li>Confirmar que tratamos seus dados.</li>
                            <li>Acessar seus dados.</li>
                            <li>Corrigir dados incorretos ou desatualizados.</li>
                            <li>Solicitar anonimização ou exclusão.</li>
                            <li>Revogar consentimento.</li>
                            <li>Portabilidade pra outro serviço.</li>
                            <li>Reclamar à ANPD (autoridade nacional).</li>
                        </ul>
                        <p className="mt-2 text-text-secondary">
                            Pra exercer qualquer um, escreva pra{" "}
                            <a
                                href="mailto:privacidade@privello.com.br"
                                className="font-medium text-accent-deep underline-offset-4 hover:underline"
                            >
                                privacidade@privello.com.br
                            </a>{" "}
                            com a solicitação. Respondemos em até 15 dias.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            7. Retenção
                        </h2>
                        <p className="text-text-secondary">
                            Mantemos seus dados enquanto a conta estiver ativa.
                            Após exclusão, retemos apenas o estritamente
                            necessário para cumprir obrigações legais (fiscais,
                            por exemplo) — geralmente 5 anos. Logs técnicos
                            são apagados após 90 dias.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            8. Cookies
                        </h2>
                        <p className="text-text-secondary">
                            Usamos apenas cookies essenciais: sessão (manter
                            login) e cooldown de visualização (evitar contagem
                            duplicada). Não usamos cookies de marketing nem
                            rastreamento de terceiros sem seu consentimento.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            9. Alterações
                        </h2>
                        <p className="text-text-secondary">
                            Esta Política pode ser atualizada. A data acima
                            indica a última revisão. Mudanças significativas são
                            comunicadas por email ou aviso na plataforma.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            10. Encarregado e contato
                        </h2>
                        <p className="text-text-secondary">
                            Encarregado pelo tratamento de dados (DPO):{" "}
                            <a
                                href="mailto:privacidade@privello.com.br"
                                className="font-medium text-accent-deep underline-offset-4 hover:underline"
                            >
                                privacidade@privello.com.br
                            </a>
                            . Veja também os nossos{" "}
                            <Link
                                href="/termos"
                                className="font-medium text-accent-deep underline-offset-4 hover:underline"
                            >
                                Termos de Uso
                            </Link>
                            .
                        </p>
                    </section>
                </div>
            </article>
        </PageSurface>
    );
}
