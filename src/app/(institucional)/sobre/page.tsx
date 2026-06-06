import type { Metadata } from "next";
import Link from "next/link";

import { PageSurface } from "@/components";

export const metadata: Metadata = {
    title: "Sobre a Privello",
    description:
        "Privello é uma plataforma brasileira de acompanhantes verificadas. Conheça nossa missão, equipe e como cuidamos da segurança e privacidade dos usuários.",
    alternates: { canonical: "/sobre" },
    openGraph: {
        title: "Sobre a Privello",
        description:
            "Plataforma brasileira de acompanhantes verificadas. Saiba mais sobre como funcionamos.",
    },
};

export default function SobrePage() {
    return (
        <PageSurface>
            <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                <header className="mb-8">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-accent-deep">
                        Quem somos
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                        Sobre a Privello
                    </h1>
                    <p className="mt-3 text-base text-text-secondary">
                        Uma plataforma brasileira que conecta acompanhantes a
                        clientes de forma segura, transparente e com privacidade.
                    </p>
                </header>

                <div className="space-y-6 text-base leading-relaxed text-text-primary">
                    <section>
                        <h2 className="mb-3 text-xl font-semibold tracking-tight">
                            Nossa missão
                        </h2>
                        <p className="text-text-secondary">
                            Criar um ambiente seguro e profissional para que
                            acompanhantes possam apresentar seus serviços com
                            dignidade e clientes possam encontrá-las com
                            transparência. Acreditamos que respeito mútuo,
                            verificação de identidade e contato direto entre as
                            partes formam a base de uma plataforma saudável.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold tracking-tight">
                            Como funcionamos
                        </h2>
                        <ul className="ml-5 list-disc space-y-2 text-text-secondary">
                            <li>
                                Acompanhantes criam perfis com fotos, vídeos,
                                áudios de apresentação e descrição de serviços.
                            </li>
                            <li>
                                Verificação de identidade opcional (e
                                recomendada) gera o selo &ldquo;Verificada&rdquo;
                                — sinal de confiança pros clientes.
                            </li>
                            <li>
                                Clientes navegam livremente pelos perfis
                                públicos. Recursos avançados (avaliações,
                                comentários, perguntas) são liberados pelo plano
                                Fan.
                            </li>
                            <li>
                                Contato é sempre direto entre as partes via
                                WhatsApp ou outro canal informado pela
                                acompanhante. A Privello não intermedia
                                encontros.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold tracking-tight">
                            Privacidade e segurança
                        </h2>
                        <p className="text-text-secondary">
                            Levamos privacidade a sério. Senhas ficam
                            armazenadas com hash forte (Argon2id), sessões são
                            assinadas, dados pessoais protegidos conforme a
                            LGPD. Saiba mais na nossa{" "}
                            <Link
                                href="/privacidade"
                                className="font-medium text-accent-deep underline-offset-4 hover:underline"
                            >
                                Política de Privacidade
                            </Link>{" "}
                            e nos{" "}
                            <Link
                                href="/termos"
                                className="font-medium text-accent-deep underline-offset-4 hover:underline"
                            >
                                Termos de Uso
                            </Link>
                            .
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold tracking-tight">
                            Conteúdo adulto
                        </h2>
                        <p className="text-text-secondary">
                            A Privello é destinada exclusivamente a maiores de
                            18 anos. Perfis de acompanhantes podem conter
                            conteúdo de natureza adulta. Ao usar a plataforma
                            você declara ter idade legal e estar em conformidade
                            com a legislação local.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold tracking-tight">
                            Contato
                        </h2>
                        <p className="text-text-secondary">
                            Dúvidas, sugestões ou relatos de problemas? Nos
                            escreva em{" "}
                            <a
                                href="mailto:contato@privello.com.br"
                                className="font-medium text-accent-deep underline-offset-4 hover:underline"
                            >
                                contato@privello.com.br
                            </a>
                            .
                        </p>
                    </section>
                </div>
            </article>
        </PageSurface>
    );
}
