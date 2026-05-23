import {
    AuthCard,
    OptionCard,
    SparklesIcon,
    UserIcon,
    type OptionCardTone,
} from "@/components";

/**
 * Página de escolha de tipo de conta (`/cadastro`).
 *
 * Antes do formulário propriamente dito, o visitante decide entre
 * Cliente e Acompanhante. Cada opção é um {@link OptionCard} com
 * ícone tonal, título, descrição e CTA, levando para o fluxo
 * correspondente.
 *
 * Layout consome o {@link AuthCard} da Biblioteca_de_Componentes
 * para herdar o wrapper visual padrão das telas de autenticação/
 * cadastro (Requirement 6.6). Mobile-first: empilha verticalmente
 * em telas pequenas, com espaço de toque generoso e hierarquia
 * tipográfica clara.
 */

interface Opcao {
    href: string;
    titulo: string;
    descricao: string;
    icon: React.ReactNode;
    cta: string;
    tone: OptionCardTone;
}

const OPCOES: ReadonlyArray<Opcao> = [
    {
        href: "/cadastro/cliente",
        titulo: "Sou Cliente",
        descricao:
            "Quero descobrir Acompanhantes próximas e iniciar conversas com confiança.",
        cta: "Criar conta de Cliente",
        icon: <UserIcon size={22} />,
        tone: "primary",
    },
    {
        href: "/cadastro/acompanhante",
        titulo: "Sou Acompanhante",
        descricao:
            "Quero criar meu perfil, escolher um plano e receber novos contatos.",
        cta: "Quero ser Acompanhante",
        icon: <SparklesIcon size={22} />,
        tone: "info",
    },
];

export default function EscolhaTipoContaPage(): React.ReactElement {
    return (
        <AuthCard
            title="Como você quer começar?"
            subtitle="Escolha o tipo de conta que combina com você."
            footer={
                <>
                    Já tem conta?{" "}
                    <a
                        href="/login"
                        className="font-medium text-primary-700 hover:text-primary-800"
                    >
                        Entrar
                    </a>
                </>
            }
        >
            <div className="flex flex-col gap-3">
                {OPCOES.map((opcao) => (
                    <OptionCard
                        key={opcao.href}
                        href={opcao.href}
                        icon={opcao.icon}
                        title={opcao.titulo}
                        description={opcao.descricao}
                        cta={opcao.cta}
                        tone={opcao.tone}
                    />
                ))}
            </div>
        </AuthCard>
    );
}
