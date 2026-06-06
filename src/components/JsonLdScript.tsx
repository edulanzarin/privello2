/**
 * `<script type="application/ld+json">` server-rendered.
 *
 * Wrapper trivial usado pelas páginas que emitem múltiplos JSON-LDs
 * (Organization, WebSite, BreadcrumbList, Person, Review, etc).
 * Centraliza o `dangerouslySetInnerHTML + JSON.stringify` num lugar
 * só pra os callers ficarem limpos.
 *
 * Não tem termos de domínio nas props — fica fora de `primitives/`
 * só por convenção (script de SEO não é primitivo visual).
 */
export interface JsonLdScriptProps {
    data: unknown;
}

export function JsonLdScript({ data }: JsonLdScriptProps): React.ReactElement {
    return (
        <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
