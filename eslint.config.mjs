import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default tseslint.config(
  { ignores: ['main.js', 'dist/**', 'coverage/**', 'node_modules/**', 'tests/**', '**/*.js', '**/*.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // Supplies the rules the Community Portal's review scan runs (popout-window
  // safe globals, Obsidian DOM helpers, banned modules). Without it the local
  // gate cannot see what the portal reports.
  ...obsidianmd.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // The no-unsafe-* family is deliberately left at its recommendedTypeChecked
      // default. It used to be disabled here, which is how v0.1.0 shipped 16
      // Community Portal findings that `npm run lint` never reported: the portal
      // runs these rules, we did not. Do not re-disable — see the
      // "Local Lint Parity With the Portal Scan" requirement in
      // openspec/specs/community-portal-compliance/spec.md
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
    },
  }
);
