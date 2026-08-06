// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'scraped-output/',
      'playwright-report/',
      'test-results/',
      '.features-gen/',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // playwright-bdd verplicht een fixtures-object als eerste argument van elke step, ook als
    // er geen fixture nodig is (dan {}). Dat botst met ESLint's no-empty-pattern, die normaal
    // een per-ongeluk-lege destructure detecteert; hier is het een vaste, bewuste conventie.
    files: ['features/steps/**/*.ts'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },
);
