"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";

import {
    Button,
    ChipGroup,
    Input,
    Select,
    Switch,
} from "@/components";
import {
    ALTURA_CM,
    CORES_OLHOS,
    ESTILOS_CABELO,
    ETNIAS,
    IDIOMAS,
    PESO_KG,
    TAMANHOS_CABELO,
    TAMANHO_PE,
} from "@/domain/aparencia/definitions";
import { GENEROS } from "@/domain/genero";
import { ATENDE, PRATICAS } from "@/domain/atendimento";

import {
    SALVAR_ETAPA_INITIAL,
    type SalvarEtapaState,
    type SalvarEtapaValue,
} from "../../action-state";
import { salvarEtapaAction } from "../../actions";

/**
 * Step 4 — Aparência (características pessoais).
 *
 * **Todos os campos são opcionais** — a Acompanhante pode pular o passo
 * inteiro ou preencher só parte. O step inteiro pode ser editado depois
 * no painel privado.
 *
 * Reusa primitivos da Biblioteca_de_Componentes:
 * - {@link Input} (com `trailingIcon` para sufixos "kg" / "cm") para
 *   campos numéricos com range definido em
 *   `@/domain/aparencia/definitions`.
 * - {@link Select} para enums (etnia, cor dos olhos, estilo/tamanho do
 *   cabelo, fumante).
 * - {@link Switch} para campos binários (silicone, tatuagens, piercing).
 * - {@link ChipGroup} para idiomas (multi-select visual).
 *
 * As listas de opções vêm de `@/domain/aparencia/definitions` para que a
 * UI e a validação compartilhem a mesma fonte de verdade.
 */

export interface AparenciaStepProps {
    nextPath: string;
    previousPath: string | null;
    /**
     * Valores já salvos no draft. Cada chave é independente; campos
     * ausentes são apresentados em branco.
     */
    initialValues: Record<string, unknown>;
}

export function AparenciaStep({
    nextPath,
    previousPath,
    initialValues,
}: AparenciaStepProps): React.ReactElement {
    const [state, formAction, pending] = useActionState<
        SalvarEtapaState,
        FormData
    >(salvarEtapaAction, SALVAR_ETAPA_INITIAL);

    const fieldErrors = state.fieldErrors ?? {};
    const echoed = state.values ?? {};

    /**
     * Helper para escolher o valor inicial do campo. Em caso de erro
     * de validação, prioriza `state.values` (eco do submit) sobre o
     * `initialValues` (eco do draft).
     */
    function pickStr(key: string): string {
        const e = echoed[key];
        if (typeof e === "string") return e;
        if (typeof e === "number") return String(e);
        const i = initialValues[key];
        if (typeof i === "string") return i;
        if (typeof i === "number") return String(i);
        return "";
    }
    function pickBool(key: string): boolean {
        const e = echoed[key];
        if (typeof e === "boolean") return e;
        const i = initialValues[key];
        return typeof i === "boolean" ? i : false;
    }
    function pickArr(key: string): ReadonlyArray<string> {
        const e = echoed[key];
        if (Array.isArray(e)) {
            return (e as SalvarEtapaValue[]).filter(
                (v): v is string => typeof v === "string",
            );
        }
        const i = initialValues[key];
        if (Array.isArray(i)) {
            return (i as unknown[]).filter(
                (v): v is string => typeof v === "string",
            );
        }
        return [];
    }

    return (
        <form action={formAction} className="flex flex-col gap-7" noValidate>
            <input type="hidden" name="_step" value="aparencia" />
            <input type="hidden" name="_next" value={nextPath} />

            {/* Bloco: identidade. Gênero é o primeiro filtro da
                busca pública, então mora no topo do step. */}
            <fieldset className="flex flex-col gap-4">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Identidade
                </legend>
                <Select
                    label="Gênero"
                    name="genero"
                    defaultValue={pickStr("genero")}
                    error={Boolean(fieldErrors.genero)}
                    errorMessage={fieldErrors.genero}
                    options={GENEROS.map((o) => ({
                        value: o.value,
                        label: o.label,
                    }))}
                />
            </fieldset>

            {/* Bloco: medidas. Mobile empilha; sm+ vira 3 colunas. */}
            <fieldset className="flex flex-col gap-4">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Medidas
                </legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Input
                        label="Peso"
                        name="pesoKg"
                        type="number"
                        inputMode="numeric"
                        min={PESO_KG.min}
                        max={PESO_KG.max}
                        step={1}
                        placeholder="Informe seu peso"
                        defaultValue={pickStr("pesoKg")}
                        error={Boolean(fieldErrors.pesoKg)}
                        errorMessage={fieldErrors.pesoKg}
                        trailingIcon={
                            <span className="text-[0.7rem]">kg</span>
                        }
                    />
                    <Input
                        label="Altura"
                        name="alturaCm"
                        type="number"
                        inputMode="numeric"
                        min={ALTURA_CM.min}
                        max={ALTURA_CM.max}
                        step={1}
                        placeholder="Informe sua altura"
                        defaultValue={pickStr("alturaCm")}
                        error={Boolean(fieldErrors.alturaCm)}
                        errorMessage={fieldErrors.alturaCm}
                        trailingIcon={
                            <span className="text-[0.7rem]">cm</span>
                        }
                    />
                    <Input
                        label="Tamanho do pé"
                        name="tamanhoPe"
                        type="number"
                        inputMode="numeric"
                        min={TAMANHO_PE.min}
                        max={TAMANHO_PE.max}
                        step={1}
                        placeholder="Informe o número do pé"
                        defaultValue={pickStr("tamanhoPe")}
                        error={Boolean(fieldErrors.tamanhoPe)}
                        errorMessage={fieldErrors.tamanhoPe}
                    />
                </div>
            </fieldset>

            {/* Bloco: aparência. Selects em 2 colunas no desktop. */}
            <fieldset className="flex flex-col gap-4">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Aparência
                </legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Select
                        label="Etnia"
                        name="etnia"
                        defaultValue={pickStr("etnia")}
                        error={Boolean(fieldErrors.etnia)}
                        errorMessage={fieldErrors.etnia}
                        options={ETNIAS.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                    <Select
                        label="Cor dos olhos"
                        name="corOlhos"
                        defaultValue={pickStr("corOlhos")}
                        error={Boolean(fieldErrors.corOlhos)}
                        errorMessage={fieldErrors.corOlhos}
                        options={CORES_OLHOS.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                    <Select
                        label="Estilo do cabelo"
                        name="estiloCabelo"
                        defaultValue={pickStr("estiloCabelo")}
                        error={Boolean(fieldErrors.estiloCabelo)}
                        errorMessage={fieldErrors.estiloCabelo}
                        options={ESTILOS_CABELO.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                    <Select
                        label="Tamanho do cabelo"
                        name="tamanhoCabelo"
                        defaultValue={pickStr("tamanhoCabelo")}
                        error={Boolean(fieldErrors.tamanhoCabelo)}
                        errorMessage={fieldErrors.tamanhoCabelo}
                        options={TAMANHOS_CABELO.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                </div>
            </fieldset>

            {/* Bloco: estilo de vida. Quatro switches em coluna no mobile, 2x2 no desktop. */}
            <fieldset className="flex flex-col gap-4">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Estilo de vida
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Switch
                        name="temSilicone"
                        label="Silicone"
                        description="Possui silicone"
                        defaultChecked={pickBool("temSilicone")}
                    />
                    <Switch
                        name="temTatuagens"
                        label="Tatuagens"
                        description="Possui tatuagens"
                        defaultChecked={pickBool("temTatuagens")}
                    />
                    <Switch
                        name="temPiercing"
                        label="Piercing"
                        description="Possui piercing"
                        defaultChecked={pickBool("temPiercing")}
                    />
                    <Switch
                        name="fumante"
                        label="Fumante"
                        description="Fuma cigarro ou similar"
                        defaultChecked={pickBool("fumante")}
                    />
                </div>
            </fieldset>

            {/* Bloco: idiomas. ChipGroup ocupa toda largura. */}
            <fieldset className="flex flex-col gap-3">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Idiomas
                </legend>
                <ChipGroup
                    name="idiomas"
                    label="Idiomas que fala"
                    hint="Selecione todos que se aplicam."
                    options={IDIOMAS.map((o) => ({
                        value: o.value,
                        label: o.label,
                    }))}
                    defaultValue={pickArr("idiomas")}
                    error={Boolean(fieldErrors.idiomas)}
                    errorMessage={fieldErrors.idiomas}
                />
            </fieldset>

            {/* Bloco: público que atende. Multi-select. */}
            <fieldset className="flex flex-col gap-3">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Atende
                </legend>
                <ChipGroup
                    name="atendePublicos"
                    label="Quem você atende"
                    hint="Você pode atender qualquer público."
                    options={ATENDE.map((o) => ({
                        value: o.value,
                        label: o.label,
                    }))}
                    defaultValue={pickArr("atendePublicos")}
                    error={Boolean(fieldErrors.atendePublicos)}
                    errorMessage={fieldErrors.atendePublicos}
                />
            </fieldset>

            {/* Bloco: práticas que realiza. Multi-select. */}
            <fieldset className="flex flex-col gap-3">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Práticas
                </legend>
                <ChipGroup
                    name="realizaPraticas"
                    label="O que você realiza"
                    hint="Inclui o item Fetiche para sinalizar abertura para cenários específicos. Pode ajustar depois."
                    options={PRATICAS.map((o) => ({
                        value: o.value,
                        label: o.label,
                    }))}
                    defaultValue={pickArr("realizaPraticas")}
                    error={Boolean(fieldErrors.realizaPraticas)}
                    errorMessage={fieldErrors.realizaPraticas}
                />
            </fieldset>

            {state.formError ? (
                <p role="alert" className="text-xs text-danger-700">
                    {state.formError}
                </p>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-3">
                {previousPath !== null ? (
                    <Link
                        href={previousPath}
                        className="text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                        Voltar
                    </Link>
                ) : (
                    <span />
                )}
                <Button type="submit" loading={pending}>
                    {pending ? "Salvando." : "Continuar"}
                </Button>
            </div>
        </form>
    );
}
