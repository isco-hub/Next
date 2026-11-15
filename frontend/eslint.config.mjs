import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import noLiteralJsx from "./eslint-rules/no-literal-jsx.mjs";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "apps/web/public/mockServiceWorker.js",
      "apps/web/dev-dist/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.worker },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/*.tsx"],
    plugins: { "jsx-a11y": jsxA11y, "react-hooks": reactHooks },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["region"] }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["apps/web/src/**/*.tsx", "packages/ui/src/**/*.tsx"],
    ignores: [
      "**/*.test.tsx",
      "**/mocks/**",
      "apps/web/src/features/dev/**",
      "apps/web/src/app/ErrorBoundary.tsx",
    ],
    plugins: { nextcrop: { rules: { "no-literal-jsx": noLiteralJsx } } },
    rules: { "nextcrop/no-literal-jsx": "error" },
  },
  {
    files: ["**/*.test.{ts,tsx}", "vitest.setup.ts", "e2e/**"],
    rules: {
      "nextcrop/no-literal-jsx": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["apps/web/src/features/dev/**", "apps/web/src/mocks/**"],
    rules: { "nextcrop/no-literal-jsx": "off" },
  },
  {
    files: ["**/*.tsx"],
    plugins: { "react-refresh": reactRefresh },
    rules: { "react-refresh/only-export-components": "off" },
  },
);
