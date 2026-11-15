import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@nextcrop/api-client": resolvePath("./packages/api-client/src/index.ts"),
      "@nextcrop/i18n": resolvePath("./packages/i18n/src/index.tsx"),
      "@nextcrop/ui": resolvePath("./packages/ui/src/index.ts"),
      "@nextcrop/testing": resolvePath("./packages/testing/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "apps/web/src/**/*.test.{ts,tsx}",
      "packages/**/*.test.{ts,tsx}",
    ],
    exclude: ["e2e/**", "**/node_modules/**"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "packages/api-client/src/**",
        "packages/i18n/src/**",
        "apps/web/src/lib/**",
        "apps/web/src/features/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/index.ts",
        "**/mocks/**",
        "**/*.test.{ts,tsx}",
        "packages/testing/src/**",
        "apps/web/src/features/**/*.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
