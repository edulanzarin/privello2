import { NextResponse } from "next/server";

import {
    ALTURA_CM,
    PESO_KG,
    TAMANHO_PE,
    isCorOlhos,
    isEstiloCabelo,
    isEtnia,
    isIdioma,
    isTamanhoCabelo,
} from "@/domain/aparencia/definitions";
import { isAtende, isPratica } from "@/domain/atendimento";
import {
    VALOR_HORA_CENTS,
    isDiaSemana,
    isFormaPagamento,
} from "@/domain/atendimentoComercial";
import { isGenero } from "@/domain/genero";
import {
    normalizarNome,
    normalizarTelefone,
    validarDescricao,
    validarNome,
    validarTelefone,
} from "@/domain/validation";
import { db } from "@/lib/db";
import { requireSession } from "@/server/auth/guards";

/**
 * Endpoint de atualização parcial do perfil do usuário autenticado.
 *
 * Body JSON com qualquer subconjunto de campos editáveis.
 *
 * Campos aceitos por `userType`:
 *
 * **Cliente**:
 *   - `nome` (string)
 *
 * **Acompanhante**:
 *   - `nome` (string)
 *   - `descricao` (string)
 *   - `telefone` (string)
 *   - `estadoSigla` + `cidadeNome` (+ `bairroNome?`)
 *   - `genero` (`MULHER` | `HOMEM` | `TRANS`)
 *   - `atendePublicos` (array de `Atende`)
 *   - `realizaPraticas` (array de `Pratica`)
 *   - `pesoKg`, `alturaCm`, `tamanhoPe` (números com range)
 *   - `etnia`, `corOlhos`, `estiloCabelo`, `tamanhoCabelo` (enums)
 *   - `temSilicone`, `temTatuagens`, `temPiercing`, `fumante` (boolean)
 *   - `idiomas` (array de `Idioma`)
 *   - `valorHoraCents` (número, em centavos BRL)
 *   - `formasPagamento` (array de `FormaPagamento`)
 *   - `diasAtende` (array de `DiaSemana`)
 *
 * Campos não editáveis aqui (email, identificador): retornam
 * `VALIDACAO`. Senha tem fluxo dedicado em `/api/conta/senha`. Foto
 * de perfil em `/api/conta/foto`. Capa em `/api/conta/capa`.
 *
 * Mapeamento de respostas:
 * - `200`: `{ ok: true }`.
 * - `400`: `{ ok: false, reason: "VALIDACAO", detalhes?: { campo: msg } }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;

    let body: Record<string, unknown>;
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error("body inválido");
        }
        body = parsed as Record<string, unknown>;
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const detalhes: Record<string, string> = {};
    const userPatch: { nome?: string } = {};
    // O patch da Acompanhante é tipado como Record solto porque o
    // Prisma já valida o shape exato no `update({ data })`. Dessa
    // forma evitamos enumerar todos os 20+ campos editáveis duas
    // vezes (aqui e no schema).
    const acompanhantePatch: Record<string, unknown> = {};

    // -- nome (Cliente e Acompanhante) --------------------------------
    if (body.nome !== undefined) {
        if (typeof body.nome !== "string" || !validarNome(body.nome)) {
            detalhes.nome = "Informe um nome válido (2 a 80 caracteres).";
        } else {
            userPatch.nome = normalizarNome(body.nome);
        }
    }

    if (auth.userType === "ACOMPANHANTE") {
        // -- descrição ----------------------------------------------------
        if (body.descricao !== undefined) {
            if (
                typeof body.descricao !== "string" ||
                !validarDescricao(body.descricao)
            ) {
                detalhes.descricao =
                    "Descrição deve ter entre 1 e 1000 caracteres.";
            } else {
                acompanhantePatch.descricao = body.descricao.trim();
            }
        }
        // -- telefone -----------------------------------------------------
        if (body.telefone !== undefined) {
            if (
                typeof body.telefone !== "string" ||
                !validarTelefone(body.telefone)
            ) {
                detalhes.telefone = "Telefone inválido.";
            } else {
                acompanhantePatch.telefone = normalizarTelefone(body.telefone);
            }
        }
        // -- localização --------------------------------------------------
        if (body.estadoSigla !== undefined) {
            if (
                typeof body.estadoSigla !== "string" ||
                body.estadoSigla.length !== 2
            ) {
                detalhes.estadoSigla = "UF inválida.";
            } else {
                acompanhantePatch.estadoSigla = body.estadoSigla.toUpperCase();
            }
        }
        if (body.cidadeNome !== undefined) {
            if (
                typeof body.cidadeNome !== "string" ||
                body.cidadeNome.trim().length === 0
            ) {
                detalhes.cidadeNome = "Cidade inválida.";
            } else {
                acompanhantePatch.cidadeNome = body.cidadeNome.trim();
            }
        }
        if (body.bairroNome !== undefined) {
            if (body.bairroNome === null) {
                acompanhantePatch.bairroNome = null;
            } else if (
                typeof body.bairroNome !== "string" ||
                body.bairroNome.trim().length === 0
            ) {
                detalhes.bairroNome = "Bairro inválido.";
            } else {
                acompanhantePatch.bairroNome = body.bairroNome.trim();
            }
        }
        // -- gênero -------------------------------------------------------
        if (body.genero !== undefined) {
            if (typeof body.genero !== "string" || !isGenero(body.genero)) {
                detalhes.genero = "Gênero inválido.";
            } else {
                acompanhantePatch.genero = body.genero;
            }
        }
        // -- atende públicos ----------------------------------------------
        if (body.atendePublicos !== undefined) {
            if (!Array.isArray(body.atendePublicos)) {
                detalhes.atendePublicos = "Formato inválido.";
            } else {
                const filtered = body.atendePublicos.filter(isAtende);
                if (filtered.length !== body.atendePublicos.length) {
                    detalhes.atendePublicos = "Opção inválida.";
                } else if (filtered.length === 0) {
                    detalhes.atendePublicos =
                        "Selecione pelo menos um público.";
                } else {
                    acompanhantePatch.atendePublicos = filtered;
                }
            }
        }
        // -- práticas -----------------------------------------------------
        if (body.realizaPraticas !== undefined) {
            if (!Array.isArray(body.realizaPraticas)) {
                detalhes.realizaPraticas = "Formato inválido.";
            } else {
                const filtered = body.realizaPraticas.filter(isPratica);
                if (filtered.length !== body.realizaPraticas.length) {
                    detalhes.realizaPraticas = "Prática inválida.";
                } else {
                    acompanhantePatch.realizaPraticas = filtered;
                }
            }
        }
        // -- numéricos com range -----------------------------------------
        const numFields = [
            { key: "pesoKg", range: PESO_KG, label: "Peso" },
            { key: "alturaCm", range: ALTURA_CM, label: "Altura" },
            { key: "tamanhoPe", range: TAMANHO_PE, label: "Tamanho do pé" },
        ] as const;
        for (const f of numFields) {
            if (body[f.key] === undefined) continue;
            const v = body[f.key];
            if (v === null) {
                acompanhantePatch[f.key] = null;
                continue;
            }
            if (typeof v !== "number" || !Number.isInteger(v)) {
                detalhes[f.key] = `${f.label} deve ser um número inteiro.`;
            } else if (v < f.range.min || v > f.range.max) {
                detalhes[f.key] =
                    `${f.label} deve estar entre ${f.range.min} e ${f.range.max}.`;
            } else {
                acompanhantePatch[f.key] = v;
            }
        }
        // -- enums opcionais ---------------------------------------------
        const enumGuards = {
            etnia: { guard: isEtnia, label: "Etnia" },
            corOlhos: { guard: isCorOlhos, label: "Cor dos olhos" },
            estiloCabelo: {
                guard: isEstiloCabelo,
                label: "Estilo do cabelo",
            },
            tamanhoCabelo: {
                guard: isTamanhoCabelo,
                label: "Tamanho do cabelo",
            },
        } as const;
        for (const key of Object.keys(enumGuards) as Array<
            keyof typeof enumGuards
        >) {
            if (body[key] === undefined) continue;
            const v = body[key];
            if (v === null) {
                acompanhantePatch[key] = null;
                continue;
            }
            if (typeof v !== "string" || !enumGuards[key].guard(v)) {
                detalhes[key] = `${enumGuards[key].label} inválida.`;
            } else {
                acompanhantePatch[key] = v;
            }
        }
        // -- booleans -----------------------------------------------------
        const boolFields = [
            "temSilicone",
            "temTatuagens",
            "temPiercing",
            "fumante",
        ] as const;
        for (const key of boolFields) {
            if (body[key] === undefined) continue;
            const v = body[key];
            if (v === null) {
                acompanhantePatch[key] = null;
            } else if (typeof v !== "boolean") {
                detalhes[key] = "Valor inválido.";
            } else {
                acompanhantePatch[key] = v;
            }
        }
        // -- idiomas (multi-select) --------------------------------------
        if (body.idiomas !== undefined) {
            if (!Array.isArray(body.idiomas)) {
                detalhes.idiomas = "Formato inválido.";
            } else {
                const filtered = body.idiomas.filter(isIdioma);
                if (filtered.length !== body.idiomas.length) {
                    detalhes.idiomas = "Idioma inválido.";
                } else {
                    acompanhantePatch.idiomas = filtered;
                }
            }
        }
        // -- valor da hora (centavos, com range) -------------------------
        if (body.valorHoraCents !== undefined) {
            const v = body.valorHoraCents;
            if (v === null) {
                acompanhantePatch.valorHoraCents = null;
            } else if (typeof v !== "number" || !Number.isInteger(v)) {
                detalhes.valorHoraCents =
                    "Valor da hora deve ser um número inteiro em centavos.";
            } else if (
                v < VALOR_HORA_CENTS.min ||
                v > VALOR_HORA_CENTS.max
            ) {
                detalhes.valorHoraCents = `Valor entre R$ ${VALOR_HORA_CENTS.min / 100} e R$ ${(VALOR_HORA_CENTS.max / 100).toLocaleString("pt-BR")}.`;
            } else {
                acompanhantePatch.valorHoraCents = v;
            }
        }
        // -- formas de pagamento (multi-select) --------------------------
        if (body.formasPagamento !== undefined) {
            if (!Array.isArray(body.formasPagamento)) {
                detalhes.formasPagamento = "Formato inválido.";
            } else {
                const filtered = body.formasPagamento.filter(isFormaPagamento);
                if (filtered.length !== body.formasPagamento.length) {
                    detalhes.formasPagamento = "Forma de pagamento inválida.";
                } else if (filtered.length === 0) {
                    detalhes.formasPagamento =
                        "Selecione pelo menos uma forma de pagamento.";
                } else {
                    acompanhantePatch.formasPagamento = filtered;
                }
            }
        }
        // -- dias da semana (multi-select) -------------------------------
        if (body.diasAtende !== undefined) {
            if (!Array.isArray(body.diasAtende)) {
                detalhes.diasAtende = "Formato inválido.";
            } else {
                const filtered = body.diasAtende.filter(isDiaSemana);
                if (filtered.length !== body.diasAtende.length) {
                    detalhes.diasAtende = "Dia inválido.";
                } else if (filtered.length === 0) {
                    detalhes.diasAtende =
                        "Selecione pelo menos um dia da semana.";
                } else {
                    acompanhantePatch.diasAtende = filtered;
                }
            }
        }
    }

    if (Object.keys(detalhes).length > 0) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO", detalhes },
            { status: 400 },
        );
    }

    if (
        Object.keys(userPatch).length === 0 &&
        Object.keys(acompanhantePatch).length === 0
    ) {
        // Nada a atualizar — sucesso silencioso.
        return NextResponse.json({ ok: true }, { status: 200 });
    }

    try {
        await db.$transaction(async (tx) => {
            if (Object.keys(userPatch).length > 0) {
                await tx.user.update({
                    where: { id: auth.userId },
                    data: userPatch,
                });
            }
            if (
                auth.userType === "ACOMPANHANTE" &&
                Object.keys(acompanhantePatch).length > 0
            ) {
                await tx.acompanhanteProfile.update({
                    where: { userId: auth.userId },
                    data: acompanhantePatch,
                });
            }
        });
        return NextResponse.json({ ok: true }, { status: 200 });
    } catch {
        return NextResponse.json(
            { ok: false, reason: "PERSISTENCIA" },
            { status: 500 },
        );
    }
}
