import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "jest.config.js"]),
  eslint.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      // Express detects error handlers by arity, so unused `_next` must stay.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
]);
