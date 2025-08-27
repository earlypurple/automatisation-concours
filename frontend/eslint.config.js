import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import vitest from 'eslint-plugin-vitest';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    // This config applies to all JS/JSX files, but we will override for tests.
    ignores: ['**/*.test.js', '**/*.test.jsx'], // Ignore test files in this general config
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // This config ONLY applies to test files
    files: ['**/*.test.jsx', '**/*.test.js'],
    plugins: {
        vitest,
    },
    languageOptions: {
        globals: {
            ...globals.browser,
            ...vitest.environments.env.globals,
            "global": "readonly"
        },
        parserOptions: {
            ecmaFeatures: { jsx: true },
            sourceType: 'module',
        },
    },
    rules: {
        ...js.configs.recommended.rules, // Start with base rules
        ...vitest.configs.recommended.rules, // Add vitest rules
        'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }], // Keep our custom rule
    }
  }
]);
