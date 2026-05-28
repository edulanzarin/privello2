import * as React from "react";

/**
 * Props do {@link ProfileBanner}.
 *
 * Banner horizontal que aparece acima do header de perfil. Recebe
 * uma URL de imagem (capa) ou cai num gradiente tonal quando
 * ausente. O slot `overlay` é renderizado posicionado absolutamente
 * sobre o banner, ideal para botões pequenos ("Alterar capa") sem
 * disputar espaço com o conteúdo abaixo.
 *
 * Aspect: 4:1 em mobile (compacto), 5:1 em desktop (mais largo,
 * estilo Twitter). Mantém ratio constante para evitar saltos de
 * layout durante o load da imagem.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ProfileBannerProps {
    /**
     * URL pública da imagem de capa. Quando `null` ou `undefined`,
     * exibe um gradiente tonal `primary` como fallback.
     */
    photoUrl?: string | null;
    /**
     * Texto alternativo da imagem. Quando ausente, vira string
     * vazia (a imagem é decorativa).
     */
    alt?: string;
    /**
     * Slot opcional renderizado sobre o banner (canto superior
     * direito). Ideal para botão "Alterar capa".
     */
    overlay?: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * ProfileBanner — banner horizontal de perfil com fallback tonal.
 *
 * Visual: container com aspect ratio fixo, `overflow-hidden` e
 * `rounded-t-xl` (combina com o `PageSurface` de cantos arredondados
 * em desktop e cantos retos em mobile). Imagem `object-cover` para
 * preencher sem distorcer.
 *
 * Quando não há foto, gradiente warm `primary-200 → primary-400`
 * com leve textura — visual consistente com a paleta do produto e
 * sem "buraco branco" no perfil.
 */
export function ProfileBanner({
    photoUrl,
    alt = "",
    overlay,
    className,
}: ProfileBannerProps): React.ReactElement {
    const composed = [
        "relative w-full overflow-hidden bg-gradient-to-br from-[color:var(--accent-soft)] via-[#ffd1bf] to-[color:var(--accent)]",
        // Aspect ratio: 4:1 em mobile e 5:1 em desktop.
        "aspect-[4/1] sm:aspect-[5/1]",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={photoUrl}
                    alt={alt}
                    className="h-full w-full object-cover"
                />
            ) : null}

            {/* Vinheta inferior — gradiente preto fade pra dar
                profundidade e legibilidade caso o caller plote
                conteúdo sobreposto na base do banner. */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 via-black/0 to-transparent"
            />

            {overlay != null ? (
                <div className="absolute right-3 top-3 z-10">{overlay}</div>
            ) : null}
        </div>
    );
}
