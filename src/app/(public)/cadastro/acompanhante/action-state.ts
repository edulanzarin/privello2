/**
 * Tipos e constantes de estado inicial para as Server Actions do
 * onboarding. Separados do arquivo `actions.ts` porque Next.js 15 não
 * permite exportar objetos (não-funções) de um arquivo `"use server"`.
 *
 * Os componentes client importam daqui; as actions importam os tipos
 * daqui também quando precisam do shape de retorno.
 */

// ---------------------------------------------------------------------------
// salvarEtapaAction
// ---------------------------------------------------------------------------

export type SalvarEtapaValue =
    | string
    | number
    | boolean
    | ReadonlyArray<string>;

export type SalvarEtapaState = {
    fieldErrors?: Record<string, string>;
    formError?: string;
    /**
     * Eco dos valores submetidos pelo passo atual, para repopular o
     * formulário em caso de erro. Aceita primitivos (string, number,
     * boolean) e arrays de string para acomodar campos do step
     * "Aparência" (numéricos com unidade, switches binários, idiomas
     * multi-select).
     */
    values?: Record<string, SalvarEtapaValue>;
};

export const SALVAR_ETAPA_INITIAL: SalvarEtapaState = {};

/**
 * Helper de leitura para o eco de valores. Retorna o valor apenas se
 * ele for `string`, evitando que um número, booleano ou array vazado
 * de outros campos seja entregue a um `<input>` ou `<textarea>` que só
 * aceita string. Usar em conjunto com `??` para fallback ao valor já
 * persistido no draft.
 *
 * @example
 * defaultValue={asEtapaString(values.nome) ?? initialValues.nome}
 */
export function asEtapaString(
    value: SalvarEtapaValue | undefined,
): string | undefined {
    return typeof value === "string" ? value : undefined;
}

// ---------------------------------------------------------------------------
// uploadFotoAction
// ---------------------------------------------------------------------------

export type UploadFotoState = {
    stagedKey?: string;
    error?: string;
    ok?: boolean;
};

export const UPLOAD_FOTO_INITIAL: UploadFotoState = {};

// ---------------------------------------------------------------------------
// finalizarAction
// ---------------------------------------------------------------------------

export type FinalizarState = {
    error?: string;
    reason?: "VALIDACAO" | "EMAIL_EM_USO" | "IDENTIFICADOR_EM_USO" | "PERSISTENCIA";
    detalhes?: Record<string, string>;
};

export const FINALIZAR_INITIAL: FinalizarState = {};
