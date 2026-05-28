/**
 * Conjunto autoral de ícones inline da Privello.
 *
 * Estilo: traço fino (stroke 1.25) com terminações redondas, detalhes
 * internos delicados e algumas formas com `fill="currentColor"` para
 * dar personalidade. Distinto do padrão Lucide/Heroicons puro.
 *
 * Cada ícone é um pequeno componente SVG que herda `currentColor`,
 * portanto recebe cor via classes utilitárias (`text-...`).
 *
 * Mantemos os ícones como SVGs inline (em vez de uma dependência tipo
 * `lucide-react`) para reduzir o bundle, dar controle total sobre o
 * traço e permitir que mudanças de identidade visual sejam feitas
 * num arquivo só. Adicione novos aqui conforme a UI for crescendo.
 *
 * Nenhum ícone carrega nome de entidade de domínio (Property 29).
 */

import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

/**
 * Wrapper comum que define stroke fino padronizado e viewBox 24x24.
 * Filhos podem misturar `fill` e `stroke` à vontade conforme cada
 * desenho exige.
 */
function Svg({
    size = 16,
    children,
    ...rest
}: IconProps & { children: React.ReactNode }): React.ReactElement {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...rest}
        >
            {children}
        </svg>
    );
}

// ---------------------------------------------------------------------------
// Identidade & contato
// ---------------------------------------------------------------------------

export function MailIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M3 7.5c0-1.4 1.1-2.5 2.5-2.5h13c1.4 0 2.5 1.1 2.5 2.5v9c0 1.4-1.1 2.5-2.5 2.5h-13C4.1 19 3 17.9 3 16.5v-9Z" />
            <path d="m4 7.5 7.3 5.4c.4.3 1 .3 1.4 0L20 7.5" />
        </Svg>
    );
}

export function AtIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M15.5 8.5v4.7c0 1.4 1.1 2.6 2.5 2.6 1.5 0 2.7-1.2 2.7-2.7v-1.1A8.7 8.7 0 1 0 18 19.4" />
        </Svg>
    );
}

export function LockIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M5.5 11.5c0-.8.7-1.5 1.5-1.5h10c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5H7c-.8 0-1.5-.7-1.5-1.5v-8Z" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
            <circle cx="12" cy="15" r="0.9" fill="currentColor" stroke="none" />
        </Svg>
    );
}

export function EyeIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M2.5 12c2-3.6 5.4-6.5 9.5-6.5s7.5 2.9 9.5 6.5c-2 3.6-5.4 6.5-9.5 6.5S4.5 15.6 2.5 12Z" />
            <circle cx="12" cy="12" r="2.8" />
        </Svg>
    );
}

export function EyeOffIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M3 3l18 18" />
            <path d="M10.6 5.1c.5-.1.9-.1 1.4-.1 4.1 0 7.5 2.9 9.5 6.5a14 14 0 0 1-3.4 4.3" />
            <path d="M6.5 6.7A14 14 0 0 0 2.5 12c2 3.6 5.4 6.5 9.5 6.5 1.6 0 3.1-.4 4.4-1.1" />
            <path d="M9.6 9.6a3 3 0 0 0 4.3 4.3" />
        </Svg>
    );
}

export function UserIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20.5c.7-3.5 3.8-6 7.5-6s6.8 2.5 7.5 6" />
        </Svg>
    );
}

export function UsersIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M2.5 20c.6-3.1 3.3-5.4 6.5-5.4s5.9 2.3 6.5 5.4" />
            <path d="M16 4.5a3 3 0 0 1 0 6" />
            <path d="M22 19.5c-.4-2.2-2-4-4-4.7" />
        </Svg>
    );
}

export function PhoneIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M5.5 3.5h2.6c.6 0 1.1.4 1.3 1l1.1 3.4c.2.6 0 1.2-.5 1.5l-1.7 1.1a13 13 0 0 0 5.7 5.7l1.1-1.7c.3-.5.9-.7 1.5-.5l3.4 1.1c.6.2 1 .7 1 1.3v2.6c0 1-.8 1.7-1.7 1.7A16.5 16.5 0 0 1 3.5 5.2c0-.9.7-1.7 1.7-1.7Z" />
        </Svg>
    );
}

// ---------------------------------------------------------------------------
// Localidade
// ---------------------------------------------------------------------------

export function MapPinIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M19 10c0 5.5-7 11-7 11s-7-5.5-7-11a7 7 0 1 1 14 0Z" />
            <circle cx="12" cy="9.8" r="2.4" />
        </Svg>
    );
}

// ---------------------------------------------------------------------------
// Marca, destaque, premium
// ---------------------------------------------------------------------------

export function HeartIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="M12 20.5s-7-4.2-9.2-9C1.4 8.6 3.5 5 7 5c2.1 0 3.8 1.2 5 3 1.2-1.8 2.9-3 5-3 3.5 0 5.6 3.6 4.2 6.5-2.2 4.8-9.2 9-9.2 9Z"
                fill="currentColor"
                fillOpacity="0.18"
            />
        </Svg>
    );
}

export function SparklesIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M12 3.5 13.4 8 18 9.4 13.4 10.8 12 15.5 10.6 10.8 6 9.4 10.6 8 12 3.5Z" />
            <path d="M19 14v3" />
            <path d="M17.5 15.5h3" />
            <path d="M5.5 17v2" />
            <path d="M4.5 18h2" />
        </Svg>
    );
}

export function StarIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="M12 3.2 14.6 9l6.4.6-4.9 4.3 1.5 6.3L12 16.8l-5.6 3.4 1.5-6.3L3 9.6 9.4 9 12 3.2Z"
                fill="currentColor"
                fillOpacity="0.15"
            />
        </Svg>
    );
}

export function CrownIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="M3 8.5 7 13l3-6 2 6 2-6 3 6 4-4.5L19.5 18a1.5 1.5 0 0 1-1.5 1H6a1.5 1.5 0 0 1-1.5-1L3 8.5Z"
                fill="currentColor"
                fillOpacity="0.15"
            />
            <circle cx="3" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="21" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
        </Svg>
    );
}

export function DiamondIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="M5 9 8.5 4h7L19 9l-7 12L5 9Z"
                fill="currentColor"
                fillOpacity="0.15"
            />
            <path d="M5 9h14" />
            <path d="M9.5 9 12 21" />
            <path d="M14.5 9 12 21" />
            <path d="M8.5 4 12 9l3.5-5" />
        </Svg>
    );
}

export function FlameIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="M12 2.5c2.5 3 5.5 5.5 5.5 9.5a5.5 5.5 0 0 1-11 0c0-1.6.6-2.6 1.5-3.5.5 1 1.2 1.5 2 1.5C9 8 9 5.5 12 2.5Z"
                fill="currentColor"
                fillOpacity="0.15"
            />
            <path d="M12 22a5 5 0 0 1-5-5c0-2 1.5-3 2.5-3 .5 1 1 1.5 2 1.5-.5-2 1.5-3.5 1.5-3.5 0 4 4 3.5 4 7a5 5 0 0 1-5 3Z" />
        </Svg>
    );
}

// ---------------------------------------------------------------------------
// Setas e estados
// ---------------------------------------------------------------------------

export function ArrowRightIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
        </Svg>
    );
}

export function CheckIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M5 12.5 9.5 17 19 7" />
        </Svg>
    );
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

export function PencilIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M14 5.5 18.5 10" />
            <path d="M4.5 19.5h4l11-11a2.1 2.1 0 0 0-3-3l-11 11v3Z" />
        </Svg>
    );
}

export function ClockIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </Svg>
    );
}

export function TrashIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M4 6.5h16" />
            <path d="M9 6.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
            <path d="M6 6.5v12.5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.5" />
            <path d="M10.5 11v6" />
            <path d="M13.5 11v6" />
        </Svg>
    );
}

export function PlusIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </Svg>
    );
}

export function PlusCircleIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle
                cx="12"
                cy="12"
                r="9"
                fill="currentColor"
                fillOpacity="0.15"
            />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
        </Svg>
    );
}

export function XIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M6 6 18 18" />
            <path d="M18 6 6 18" />
        </Svg>
    );
}

export function ChevronLeftIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="m15 6-6 6 6 6" />
        </Svg>
    );
}

export function ChevronRightIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="m9 6 6 6-6 6" />
        </Svg>
    );
}

// ---------------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------------

export function ChatIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="M4 6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-7l-4 3v-3H6c-1.1 0-2-.9-2-2V6Z"
                fill="currentColor"
                fillOpacity="0.12"
            />
        </Svg>
    );
}

// ---------------------------------------------------------------------------
// Mídia
// ---------------------------------------------------------------------------

export function PlayIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="m8 5 12 7-12 7V5Z"
                fill="currentColor"
                stroke="none"
            />
        </Svg>
    );
}

export function PauseIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <rect
                x="6"
                y="5"
                width="4"
                height="14"
                rx="1"
                fill="currentColor"
                stroke="none"
            />
            <rect
                x="14"
                y="5"
                width="4"
                height="14"
                rx="1"
                fill="currentColor"
                stroke="none"
            />
        </Svg>
    );
}

export function ImageIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
            <circle cx="8.5" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
            <path d="m4 17 5-5 4 4 3-3 4 4" />
        </Svg>
    );
}

export function CameraIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M6.5 6 8 4h8l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.5Z" />
            <circle cx="12" cy="13" r="3.5" />
        </Svg>
    );
}

export function MicIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="M9 6.5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0v-6Z"
                fill="currentColor"
                fillOpacity="0.15"
            />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
            <path d="M12 18v3" />
            <path d="M9 21h6" />
        </Svg>
    );
}

export function HomeIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M3.5 11 12 4l8.5 7v8.5c0 .8-.7 1.5-1.5 1.5h-4v-6h-6v6H5c-.8 0-1.5-.7-1.5-1.5V11Z" />
        </Svg>
    );
}

export function PlayCircleIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle
                cx="12"
                cy="12"
                r="9"
                fill="currentColor"
                fillOpacity="0.12"
            />
            <path
                d="m10 8.5 6 3.5-6 3.5v-7Z"
                fill="currentColor"
                stroke="none"
            />
        </Svg>
    );
}


// ---------------------------------------------------------------------------
// Pagamento e calendário
// ---------------------------------------------------------------------------

export function CashIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <rect x="2.5" y="6" width="19" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M5.5 9v6" />
            <path d="M18.5 9v6" />
        </Svg>
    );
}

export function PixIcon(props: IconProps): React.ReactElement {
    // Diamante de quatro pontas, autoral.
    return (
        <Svg {...props}>
            <path
                d="M12 3 19.5 10.5 12 18 4.5 10.5 12 3Z"
                fill="currentColor"
                fillOpacity="0.18"
            />
            <path d="M7 9 12 4 17 9" />
            <path d="M7 12 12 17 17 12" />
        </Svg>
    );
}

export function CreditCardIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
            <path d="M2.5 9.5h19" />
            <path d="M6 14.5h4" />
        </Svg>
    );
}

export function BanknoteIcon(props: IconProps): React.ReactElement {
    // Transferência bancária — nota com seta indicando movimento.
    return (
        <Svg {...props}>
            <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
            <circle cx="12" cy="12" r="2.2" />
            <path d="M6 17.5l-1.5 1.5" />
            <path d="M19.5 5l-1.5 1.5" />
        </Svg>
    );
}

export function CalendarIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M3.5 10h17" />
            <path d="M8 3v4" />
            <path d="M16 3v4" />
        </Svg>
    );
}

/**
 * Ícone autoral para CTA de mensagens via celular. Estilizado como
 * um balão de fala arredondado dentro de um aparelho — não é o logo
 * do WhatsApp (que é trademark) e não usa as cores oficiais. O
 * preenchimento usa `currentColor` para herdar do botão.
 */
export function WhatsappIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M4.5 19.5l1.05-3.6a7.5 7.5 0 1 1 2.55 2.55Z" />
            <path d="M9 10.5c.4 1.5 1.5 2.6 3 3" />
            <path d="M9 10.5c.5-.6 1-1 1-1.5s-.5-1-1-1.5a1 1 0 0 0-1 0c-1 .5-1.2 1.7-.5 2.6" />
            <path d="M12 13.5c.6.5 1 1 1.5 1s1-.5 1.5-1a1 1 0 0 0 0-1c-.5-1-1.7-1.2-2.6-.5" />
        </Svg>
    );
}


// ---------------------------------------------------------------------------
// Aparência & medidas
// ---------------------------------------------------------------------------

/**
 * Balança de dois pratos — ícone para peso. Detalhe central
 * preenchido suaviza o traço fino.
 */
export function WeightIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7Z" />
            <circle cx="12" cy="6" r="2" fill="currentColor" />
            <path d="M10 6h4" />
            <path d="M9 12.5l3 4 3-4" />
        </Svg>
    );
}

/**
 * Régua vertical com marcações — ícone para altura.
 */
export function RulerIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <rect x="8.5" y="3" width="7" height="18" rx="1.5" />
            <path d="M12 5h2" />
            <path d="M12 8h3" />
            <path d="M12 11h2" />
            <path d="M12 14h3" />
            <path d="M12 17h2" />
        </Svg>
    );
}

/**
 * Pegada — ícone para tamanho do pé.
 */
export function FootprintIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M9.5 14.5c-1.5 0-3 1.5-3 3.5s1.5 3 3 3 3.5-1.5 3-3.5c-.3-1.5-1.2-3-3-3Z" fill="currentColor" />
            <ellipse cx="9.5" cy="6.5" rx="1.4" ry="1.8" fill="currentColor" />
            <ellipse cx="13" cy="4.5" rx="1.1" ry="1.4" fill="currentColor" />
            <ellipse cx="15.5" cy="6.5" rx="1.1" ry="1.4" fill="currentColor" />
            <ellipse cx="17" cy="9.5" rx="1" ry="1.3" fill="currentColor" />
        </Svg>
    );
}

/**
 * Tesoura aberta — ícone para cabelo / estilo do cabelo.
 */
export function ScissorsIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle cx="6.5" cy="7" r="2.5" />
            <circle cx="6.5" cy="17" r="2.5" />
            <path d="M8.5 8.5L20 17" />
            <path d="M8.5 15.5L20 7" />
        </Svg>
    );
}

/**
 * Globo simples — ícone para etnia / origem. Linhas horizontais
 * representam paralelos.
 */
export function GlobeIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3c2.5 3 2.5 15 0 18" />
            <path d="M12 3c-2.5 3-2.5 15 0 18" />
        </Svg>
    );
}

/**
 * Selo de verificação no estilo do Twitter/Instagram — escudo
 * circular com check interno. Em vez de um simples check, é uma
 * "roseta" pra dar o sinal claro de "verificado".
 */
export function VerifiedBadgeIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path
                d="M12 2.5l1.7 1.4 2.2-.2 1.1 1.9 2 .9.2 2.2 1.4 1.7-1.4 1.7-.2 2.2-2 .9-1.1 1.9-2.2-.2L12 15.7l-1.7 1.4-2.2-.2-1.1-1.9-2-.9-.2-2.2L3.4 12l1.4-1.7.2-2.2 2-.9 1.1-1.9 2.2.2L12 4.1z"
                fill="currentColor"
                stroke="none"
            />
            <path
                d="M9 9.8l2.2 2.2L15 8.2"
                stroke="white"
                strokeWidth="1.5"
            />
        </Svg>
    );
}

/**
 * Bandeira/flag para indicar denúncia.
 */
export function FlagIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M5 3v18" />
            <path d="M5 4h11l-1.5 4 1.5 4H5" fill="currentColor" />
        </Svg>
    );
}

/**
 * Ícone de "shield" — proteção/admin/segurança.
 */
export function ShieldIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M12 3l8 3v6c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
        </Svg>
    );
}

/**
 * Câmera com selo de check — usada em feature tiles tipo "Mídias
 * verificadas" / "Mídia 360°".
 */
export function CameraVerifiedIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M5 8h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
            <circle cx="12" cy="13" r="3.5" />
            <path d="M11 13l1 1 2-2" />
        </Svg>
    );
}

/**
 * Documento com check — usada em "100% verificados".
 */
export function DocumentVerifiedIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <path d="M14 3v4h4" />
            <path d="M9 13l2 2 4-4" />
        </Svg>
    );
}

/**
 * Rosto com check — verificação facial.
 */
export function FaceVerifiedIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle cx="12" cy="12" r="9" />
            <circle cx="9.5" cy="10.5" r="0.6" fill="currentColor" />
            <circle cx="14.5" cy="10.5" r="0.6" fill="currentColor" />
            <path d="M9 14c.7 1 1.8 1.5 3 1.5s2.3-.5 3-1.5" />
            <path d="M17 6l1.5 1.5L21 5" />
        </Svg>
    );
}

/**
 * Lock com check — segurança.
 */
export function SecurityCheckIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="M10 15l1.5 1.5L14 14" />
        </Svg>
    );
}

/**
 * Coração com play — reels / "Stories diariamente".
 */
export function HeartPlayIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
            <path d="M11 10v4l3-2-3-2z" fill="currentColor" stroke="none" />
        </Svg>
    );
}

/**
 * Filtro / sliders — usado em barras de busca.
 */
export function SlidersIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M4 6h12" />
            <path d="M18 6h2" />
            <circle cx="17" cy="6" r="2" />
            <path d="M4 12h6" />
            <path d="M12 12h8" />
            <circle cx="11" cy="12" r="2" />
            <path d="M4 18h12" />
            <path d="M18 18h2" />
            <circle cx="17" cy="18" r="2" />
        </Svg>
    );
}

/**
 * Search circular — usado em CTAs de busca destacados.
 */
export function SearchIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <circle cx="11" cy="11" r="6" />
            <path d="M16 16l4 4" />
        </Svg>
    );
}

/**
 * Crescimento / trending up — para "Em alta".
 */
export function TrendingUpIcon(props: IconProps): React.ReactElement {
    return (
        <Svg {...props}>
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M14 7h7v7" />
        </Svg>
    );
}
