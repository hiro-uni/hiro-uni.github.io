import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", ".astro/**", "node_modules/**", "public/**"] },
  { ...js.configs.recommended, files: ["**/*.{js,mjs,cjs}"] },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
  ...astro.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,astro}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".astro"],
      },
    },
  },
];
