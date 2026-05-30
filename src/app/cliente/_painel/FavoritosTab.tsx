import * as React from "react";

import {
    BookmarkIcon,
    EmptyState,
    ProfileFeedCard,
} from "@/components";
import type { FavoritoItem } from "@/server/favorites";

/**
 * Aba "Favoritos" do painel do Cliente.
 *
 * Lista as Acompanhantes que o Cliente marcou como favoritas, em
 * ordem desc por data de adição. Cada card é um link direto pro
 * perfil público — clicar abre `/acompanhantes/<slug>`.
 *
 * Quando vazio, mostra `EmptyState` convidativo com sugestão de
 * voltar pra busca. **Não há gate** por plano: Cliente Grátis
 * também pode salvar e ver favoritos. (Diferente de curtidas e
 * comentários, que exigem Fan.)
 *
 * # Privacidade
 *
 * A lista é privada do Cliente. A Acompanhante NUNCA vê quem a
 * salvou — apenas o COUNT total via {@link contarFavoritosDoOwner}.
 */
export interface FavoritosTabProps {
    favoritos: ReadonlyArray<FavoritoItem>;
}

export function FavoritosTab({
    favoritos,
}: FavoritosTabProps): React.ReactElement {
    if (favoritos.length === 0) {
        return (
            <EmptyState
                icon={<BookmarkIcon size={20} />}
                title="Você ainda não salvou ninguém"
                description="Toque no ícone de bookmark no perfil de uma Acompanhante pra adicionar aqui e voltar fácil depois."
            />
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {favoritos.map((f) => (
                <ProfileFeedCard
                    key={f.identificador}
                    href={`/acompanhantes/${f.identificador}`}
                    name={f.nome}
                    identifier={f.identificador}
                    photoUrl={f.fotoUrl}
                    cityName={f.cidadeNome}
                    stateSigla={f.estadoSigla}
                    neighborhood={f.bairroNome}
                    verified={f.verificada}
                    variant="split"
                />
            ))}
        </div>
    );
}
