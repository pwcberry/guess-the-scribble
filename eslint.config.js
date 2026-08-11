import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import stylistic from "@stylistic/eslint-plugin";
import {defineConfig, globalIgnores} from 'eslint/config'

export default defineConfig([
  globalIgnores(['**/dist', './shared/lib', '.release']),
  {
    files: ['**/*.{ts,tsx}', 'scripts/*.js'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      stylistic.configs.customize({
        indent: 2,
        quotes: "double",
        semi: true,
        jsx: true,
      })
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Always require braces around control-flow bodies, even single statements.
      "curly": ["error", "all"],
      // Use the TypeScript-aware rule so params in type positions (interface /
      // function-type signatures) are not reported. Preserves the repo's
      // convention of ignoring UPPER/underscore-prefixed identifiers.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        varsIgnorePattern: "^[A-Z_]",
        argsIgnorePattern: "^_",
      }],
    },
  },
  {
    // Server and shared code runs on Node, not in the browser.
    files: ['server/**/*.ts', 'shared/**/*.ts', '**/*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
