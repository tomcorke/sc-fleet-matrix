import sonarjs from 'eslint-plugin-sonarjs';
import { defineConfig } from 'oxlint';

// Ported from aion2 (Oxlint plus ESLint), running entirely in Oxlint so the
// project can use TypeScript 7, which typescript-eslint does not support.
export default defineConfig({
  plugins: ['react', 'typescript', 'oxc'],
  jsPlugins: [
    'eslint-plugin-sonarjs',
    '@stylistic/eslint-plugin',
    './oxlint-plugin.js',
  ],
  categories: { correctness: 'error' },
  ignorePatterns: ['dist', 'cache'],
  rules: {
    ...sonarjs.configs.recommended.rules,
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'error',
    'react/only-export-components': ['warn', { allowConstantExport: true }],
    'typescript/no-explicit-any': 'error',

    'max-depth': ['error', 4],
    'max-lines-per-function': [
      'error',
      { IIFEs: true, max: 100, skipBlankLines: true, skipComments: true },
    ],
    'max-nested-callbacks': ['error', 3],
    'sonarjs/cognitive-complexity': ['error', 15],

    // Space code out: a blank line around blocks, after declarations and before returns.
    '@stylistic/padding-line-between-statements': [
      'error',
      {
        blankLine: 'always',
        prev: '*',
        next: ['return', 'block-like', 'export'],
      },
      {
        blankLine: 'always',
        prev: ['const', 'let', 'var', 'block-like', 'directive', 'import'],
        next: '*',
      },
      {
        blankLine: 'any',
        prev: ['const', 'let', 'var'],
        next: ['const', 'let', 'var'],
      },
      { blankLine: 'any', prev: 'import', next: 'import' },
      { blankLine: 'any', prev: 'export', next: 'export' },
    ],

    // Components import only their own CSS module; global styles load once from main.tsx.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/*.scss', '!**/*.module.scss'],
            message: 'Import a co-located .module.scss instead.',
          },
        ],
      },
    ],
    'local/css-module-import-name': 'error',
  },
  overrides: [
    {
      files: ['src/client/main.tsx'],
      rules: { 'no-restricted-imports': 'off' },
    },
    {
      // Markup-heavy JSX trips function-length limits without adding real complexity.
      files: ['src/**/*.tsx'],
      rules: { 'max-lines-per-function': 'off' },
    },
  ],
});
