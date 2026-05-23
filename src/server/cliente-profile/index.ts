import { db } from "@/lib/db";

/**
 * Forma do perfil de Cliente consumida pela camada de UI.
 *
 * Modela apenas os campos efetivamente exibidos pela área do Cliente
 * (`/cliente`, `/cliente/conta`). Quando a UI precisar de campos
 * adicionais, estendemos este tipo aqui em vez de espalhar `findUnique`s
 * por componentes.
 *
 * Espelha `PerfilAcompanhanteResumo` em `@/server/acompanhante-profile`,
 * adaptado às colunas de `ClientProfile`.
 */
export type PerfilClienteResumo = {
    userId: string;
    nome: string;
    email: string;
    identificador: string;
    /**
     * URL pública da Foto_de_Perfil. `null` quando o Cliente não tem
     * foto registrada (Cliente pode optar por não enviar foto no
     * cadastro — diferente da Acompanhante).
     */
    fotoUrl: string | null;
    /**
     * Plano vigente do Cliente. `null` quando o Cliente ainda não
     * passou pela tela de seleção pós-cadastro (cenário possível se
     * o usuário fechou a aba).
     */
    planoVigente: "GRATIS" | "FAN" | null;
    /**
     * Quando o Cliente confirmou o plano vigente. `null` quando
     * `planoVigente` também é `null`.
     */
    planoSelecionadoEm: Date | null;
};

/**
 * Lê o perfil resumo de um Cliente por `userId`.
 *
 * Combina `User`, `ClientProfile` e a `Media` da Foto_de_Perfil em
 * uma única consulta via `include`. Retorna `null` quando o `userId`
 * não corresponde a um Cliente (por exemplo, a sessão é de
 * Acompanhante).
 *
 * # Resolução da `fotoUrl`
 *
 * A `Media` armazena apenas `storageKey`. Esta função traduz a chave
 * para o caminho público que o `R2Client.presignedUrl` (em produção)
 * ou a rota dev `/api/storage/[...key]` consegue servir. Em
 * desenvolvimento o arquivo está em `.storage/<key>` e é exposto via
 * `/api/storage/<key>`, então a URL pode ser uma string relativa.
 */
export async function obterPerfilCliente(
    userId: string,
): Promise<PerfilClienteResumo | null> {
    const profile = await db.clientProfile.findUnique({
        where: { userId },
        include: {
            user: {
                select: {
                    nome: true,
                    email: true,
                    identificador: true,
                },
            },
            fotoPerfil: {
                select: { storageKey: true },
            },
        },
    });

    if (!profile) {
        return null;
    }

    return {
        userId: profile.userId,
        nome: profile.user.nome,
        email: profile.user.email,
        identificador: profile.user.identificador,
        fotoUrl: profile.fotoPerfil
            ? `/api/storage/${profile.fotoPerfil.storageKey}`
            : null,
        planoVigente: profile.planoVigente,
        planoSelecionadoEm: profile.planoSelecionadoEm,
    };
}
