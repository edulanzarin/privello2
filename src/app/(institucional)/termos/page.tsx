import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript, PageSurface } from "@/components";

export const metadata: Metadata = {
    title: "Termos de Uso",
    description:
        "Termos de uso da Privello — regras, direitos e deveres ao usar a plataforma de acompanhantes verificadas.",
    alternates: { canonical: "/termos" },
};

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const ULTIMA_REVISAO = "5 de junho de 2026";

export default function TermosPage() {
    const breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Início",
                item: `${SITE_URL}/`,
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Termos de Uso",
                item: `${SITE_URL}/termos`,
            },
        ],
    };

    return (
        <PageSurface>
            <JsonLdScript data={breadcrumb} />
            <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                <header className="mb-8">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-accent-deep">
                        Documento legal
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                        Termos de Uso
                    </h1>
                    <p className="mt-3 text-sm text-text-secondary">
                        Última revisão: {ULTIMA_REVISAO}
                    </p>
                </header>

                <div className="space-y-8 text-sm leading-relaxed text-text-primary">
                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            1. Aceitação
                        </h2>
                        <p className="text-text-secondary">
                            Ao acessar ou usar a Privello, você concorda com
                            estes Termos. Se não concorda, por favor não use a
                            plataforma. Estes Termos podem ser atualizados; a
                            data acima indica a última revisão. Mudanças
                            relevantes são comunicadas por email ou aviso na
                            plataforma.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            2. Quem pode usar
                        </h2>
                        <p className="text-text-secondary">
                            A Privello é destinada a maiores de 18 anos. Ao
                            criar conta você declara ter idade legal e
                            capacidade civil. Menores de idade têm acesso
                            proibido. Caso identifiquemos uso por menores, a
                            conta é removida imediatamente.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            3. Tipos de conta
                        </h2>
                        <p className="text-text-secondary">
                            Existem dois tipos: <strong>Cliente</strong> (visita
                            perfis e contrata via WhatsApp diretamente com a
                            acompanhante) e <strong>Acompanhante</strong>{" "}
                            (cadastra perfil e oferece serviços). Cada conta tem
                            recursos próprios e fluxos de pagamento distintos.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            4. Conteúdo dos perfis
                        </h2>
                        <p className="mb-2 text-text-secondary">
                            Acompanhantes são responsáveis pelo conteúdo que
                            publicam. É proibido:
                        </p>
                        <ul className="ml-5 list-disc space-y-1 text-text-secondary">
                            <li>Imagens ou vídeos de outras pessoas sem consentimento.</li>
                            <li>Conteúdo envolvendo menores de idade (qualquer forma).</li>
                            <li>Promoção de violência, tráfico humano ou drogas.</li>
                            <li>Cobranças por serviços ilegais.</li>
                            <li>Identidades falsas, fotos manipuladas ou enganosas.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            5. Verificação de identidade
                        </h2>
                        <p className="text-text-secondary">
                            Acompanhantes podem solicitar verificação enviando
                            documento e selfie. A análise é manual e gera um
                            selo &ldquo;Verificada&rdquo;. Os documentos ficam
                            em armazenamento seguro e privado, acessíveis apenas
                            à equipe de moderação. Após aprovação, o documento
                            pode ser excluído mediante solicitação por email.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            6. Pagamentos
                        </h2>
                        <p className="mb-2 text-text-secondary">
                            Pagamentos são processados pela Stripe. A Privello
                            cobra:
                        </p>
                        <ul className="ml-5 list-disc space-y-1 text-text-secondary">
                            <li>
                                <strong>Plano Premium</strong> (Acompanhante):
                                mensalidade pelo acesso a recursos avançados.
                            </li>
                            <li>
                                <strong>Boost</strong> (Acompanhante): impulso
                                de 24h pra prioridade nas buscas.
                            </li>
                            <li>
                                <strong>Plano Fan</strong> (Cliente): 24h, 7
                                dias ou 30 dias de acesso a interações
                                avançadas.
                            </li>
                        </ul>
                        <p className="mt-2 text-text-secondary">
                            Não há reembolso para serviços já entregues
                            (período já consumido). Cancelamentos antes do
                            primeiro uso podem ser solicitados em até 7 dias por
                            email, conforme o Código de Defesa do Consumidor.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            7. Contato entre cliente e acompanhante
                        </h2>
                        <p className="text-text-secondary">
                            A Privello é uma plataforma de exposição. O contato,
                            negociação e encontros acontecem fora da plataforma,
                            geralmente via WhatsApp. A Privello{" "}
                            <strong>não intermedia</strong> nem é parte em
                            qualquer relação contratual entre cliente e
                            acompanhante. Cada um é responsável pela própria
                            segurança e cumprimento do que combinarem.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            8. Conduta proibida
                        </h2>
                        <ul className="ml-5 list-disc space-y-1 text-text-secondary">
                            <li>Assédio, ameaça ou intimidação a outros usuários.</li>
                            <li>Fraude, golpe ou tentativa de extorsão.</li>
                            <li>Engenharia reversa ou ataques à plataforma.</li>
                            <li>Criação de múltiplas contas para burlar limites.</li>
                            <li>Compartilhamento de dados pessoais alheios.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            9. Suspensão e exclusão
                        </h2>
                        <p className="text-text-secondary">
                            Reservamos o direito de suspender ou excluir contas
                            que violem estes Termos, com ou sem aviso prévio
                            conforme a gravidade. Você pode excluir sua conta a
                            qualquer momento entrando em contato pelo email
                            abaixo.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            10. Limitação de responsabilidade
                        </h2>
                        <p className="text-text-secondary">
                            A Privello fornece a plataforma &ldquo;como
                            está&rdquo;. Não garantimos disponibilidade
                            ininterrupta nem nos responsabilizamos por danos
                            decorrentes de relações entre usuários. Em caso de
                            falha grave do nosso lado, a responsabilidade
                            limita-se ao valor pago pelo serviço afetado.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            11. Foro
                        </h2>
                        <p className="text-text-secondary">
                            Estes Termos são regidos pela legislação
                            brasileira. Fica eleito o foro da comarca de domicílio
                            do consumidor para dirimir eventuais conflitos.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-2 text-base font-semibold">
                            12. Contato
                        </h2>
                        <p className="text-text-secondary">
                            Dúvidas sobre estes Termos:{" "}
                            <a
                                href="mailto:contato@privello.com.br"
                                className="font-medium text-accent-deep underline-offset-4 hover:underline"
                            >
                                contato@privello.com.br
                            </a>
                            . Veja também a nossa{" "}
                            <Link
                                href="/privacidade"
                                className="font-medium text-accent-deep underline-offset-4 hover:underline"
                            >
                                Política de Privacidade
                            </Link>
                            .
                        </p>
                    </section>
                </div>
            </article>
        </PageSurface>
    );
}
