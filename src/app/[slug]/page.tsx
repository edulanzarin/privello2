import { notFound, redirect } from "next/navigation";

/**
 * Atalho de URL curta (vanity) pro perfil público.
 *
 * Permite `privello.com.br/<identificador>` levar direto pra
 * `/acompanhantes/<identificador>` — útil como link compartilhável
 * curto (estampado na marca d'água das mídias).
 *
 * # Por que isso não engole as outras rotas
 *
 * Este é um segmento dinâmico no nível raiz (`[slug]`). No App Router
 * do Next.js, segmentos **estáticos/nomeados** sempre vencem o
 * dinâmico no mesmo nível. Então `/login`, `/reels`, `/acompanhantes`,
 * `/cliente`, `/acompanhante`, `/admin`, `/cadastro` e os route
 * handlers de `/api/*` continuam resolvendo pras suas próprias
 * páginas; só caminhos de segmento único que **não** batem em
 * nenhuma rota nomeada caem aqui.
 *
 * Arquivos gerados (`robots.txt`, `sitemap.xml`, `manifest.webmanifest`,
 * `icon.png`) também têm rota própria e têm prioridade. Por garantia,
 * qualquer slug que contenha `.` (parece arquivo) cai em `notFound`
 * em vez de redirecionar.
 *
 * O redirect é temporário (307): a existência real do perfil é
 * resolvida em `/acompanhantes/[slug]` (que mostra "não encontrado"
 * quando o identificador não existe).
 */
export default async function VanitySlugPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<never> {
    const { slug } = await params;

    // Requests que parecem arquivo (têm extensão) não são perfis.
    if (slug.includes(".")) {
        notFound();
    }

    redirect(`/acompanhantes/${encodeURIComponent(slug)}`);
}
