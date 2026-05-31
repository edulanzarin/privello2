/**
 * Regression test pro interop do maplibre-gl (T14).
 *
 * O `maplibre-gl@4.x` publica um bundle UMD (sem campo `exports`/
 * `module` no package.json). Quando o bundler do browser importa
 * via `await import()`, o `module.exports` inteiro vira o `.default`
 * do namespace ES — então `mod.Map` (named) fica `undefined` e o
 * mapa quebra com "Mapa indisponível".
 *
 * `resolveMaplibreModule` normaliza os dois shapes. Este teste
 * garante que ambos resolvem e que um módulo sem `Map` lança.
 */

import { describe, expect, it } from "vitest";

import { resolveMaplibreModule } from "@/app/(shell)/acompanhantes/_busca/BuscaMapa";

class FakeMap {}
class FakeNav {}
class FakeBounds {}

const fakeModuleShape = {
    Map: FakeMap,
    NavigationControl: FakeNav,
    LngLatBounds: FakeBounds,
};

describe("resolveMaplibreModule", () => {
    it("resolve quando os named exports estão na raiz (shape ESM)", () => {
        const resolved = resolveMaplibreModule({ ...fakeModuleShape });
        expect(resolved.Map).toBe(FakeMap);
        expect(resolved.NavigationControl).toBe(FakeNav);
    });

    it("resolve quando tudo está em .default (shape UMD/CJS)", () => {
        const resolved = resolveMaplibreModule({
            default: { ...fakeModuleShape },
        });
        expect(resolved.Map).toBe(FakeMap);
        expect(resolved.LngLatBounds).toBe(FakeBounds);
    });

    it("prefere a raiz quando ambos têm Map", () => {
        class RootMap {}
        const resolved = resolveMaplibreModule({
            Map: RootMap,
            NavigationControl: FakeNav,
            LngLatBounds: FakeBounds,
            default: { ...fakeModuleShape },
        });
        expect(resolved.Map).toBe(RootMap);
    });

    it("lança quando não há export Map em lugar nenhum", () => {
        expect(() => resolveMaplibreModule({ foo: 1 })).toThrow();
        expect(() => resolveMaplibreModule(null)).toThrow();
        expect(() =>
            resolveMaplibreModule({ default: { foo: 1 } }),
        ).toThrow();
    });
});
