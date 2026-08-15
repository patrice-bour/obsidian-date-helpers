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
      // `ignoreRestSiblings` is what lets a destructuring rest drop properties
      // (`const { name, ...rest } = preset`) without naming the dropped ones as
      // used — the idiom the preset-label migration relies on.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // Translated strings are inserted verbatim: I18nService.interpolate does no
      // HTML escaping because every consumer assigns textContent. These sinks
      // would make that assumption false without anyone noticing.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Assign text, not HTML: translations are not escaped.' },
        { property: 'outerHTML', message: 'Assign text, not HTML: translations are not escaped.' },
        {
          property: 'insertAdjacentHTML',
          message: 'Build elements with createEl/createDiv instead.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // The no-unsafe-* family is deliberately left at its recommendedTypeChecked
      // default. It used to be disabled here, which is how v0.1.0 shipped 16
      // Community Portal findings that `npm run lint` never reported: the portal
      // runs these rules, we did not. Do not re-disable: `npm run lint` has to
      // report what the portal's review scan reports.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
    },
  }
);
