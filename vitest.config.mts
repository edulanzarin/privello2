import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest configuration for the Privello platform.
 *
 * - `jsdom` environment so component tests in the Biblioteca_de_Componentes can run.
 * - `tsconfigPaths` plugin honors the `@/*` aliases declared in `tsconfig.json`.
 * - `setupFiles` registers `@testing-library/jest-dom` matchers.
 *
 * The CI command in `package.json` runs `vitest --run`, so by default test runs
 * are non-watching and terminable.
 *
 * The file uses the `.mts` extension because `vite-tsconfig-paths` is ESM-only.
 */
export default defineConfig({
    plugins: [tsconfigPaths()],
    esbuild: {
        jsx: "automatic",
        jsxImportSource: "react",
    },
    test: {
        environment: "jsdom",
        globals: false,
        include: [
            "tests/**/*.test.ts",
            "tests/**/*.test.tsx",
        ],
        setupFiles: ["./tests/setup.ts"],
        clearMocks: true,
        restoreMocks: true,
    },
});
