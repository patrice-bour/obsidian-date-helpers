# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-05-16

Cleanup release addressing the warnings reported by the Obsidian Community Portal scorecard on v0.1.0 (https://community.obsidian.md/plugins/date-helpers).

### Added

- `DailyNotesPluginAdapter` — single typed surface around `app.internalPlugins.getPluginById('daily-notes')`, with the codebase's only `@ts-expect-error`.
- CI dependency-audit gate (`npm audit --audit-level=moderate`) in `.github/workflows/ci.yml`.
- Release workflow (`.github/workflows/release.yml`) on `v*` tags: builds, runs `npm audit` + `npm run validate`, attaches a GitHub artifact attestation via `actions/attest-build-provenance@v2`, and publishes the GitHub Release with `main.js`, `manifest.json`, `styles.css`.

### Changed

- UI uses popout-window-safe globals: `activeDocument` and `activeWindow.setTimeout` / `activeWindow.clearTimeout` instead of the bare browser globals in `src/ui/settings-tab.ts` and `src/ui/unified-date-picker-modal.ts`.
- Format selector option created via Obsidian's `createEl()` helper rather than `document.createElement`.
- Bundler configs (`rollup.config.js`, `esbuild.config.mjs`) import `builtinModules` from Node's native `node:module`; the `builtin-modules` npm package is dropped.
- Bumped vulnerable transitive devDeps (`ts-jest`, `@typescript-eslint/*`, `eslint` 8.x patch, `@types/jest`, `@rollup/plugin-commonjs`, `esbuild`); `npm audit --audit-level=moderate` now reports **0 vulnerabilities**.
- `loadSettings()` no longer leaks `any` from `loadData()` (typed via `unknown` + runtime guard).
- `I18nService.interpolate()` rewritten without `any`; new tests pin behaviour for empty-string / `0` / `false` / `null` / missing-key params.

### Fixed

- Compliance with the new Obsidian Community Portal scanner rules (popout-window compatibility, type-safety around internal APIs, banned build dependencies).

### Notes

Local pre-scan via `eslint-plugin-obsidianmd` requires ESLint 9 + flat config; tracked as a deliberate follow-up — see `CONTRIBUTING.md`.

## [0.1.0] - 2026-04-12

Initial public release of **Date Helpers** — a comprehensive date toolkit for Obsidian with keyboard-first interaction, natural language parsing, and full internationalization support.

### Added

- **Exclusive modes**: choose between Text formatting or Daily Notes wikilinks
- **Interactive date picker** with calendar modal and full keyboard navigation
  - Arrow keys to navigate days, `Cmd/Ctrl + ←/→` for months, `Cmd/Ctrl + ↑/↓` for years
  - Configurable trigger character (default `@@`) for inline insertion
- **Natural language parsing** via chrono-node:
  - Relative expressions: "today", "tomorrow", "3 days ago", "in 2 weeks"
  - Weekdays: "next Monday", "last Friday", "this Wednesday"
  - Time expressions: "tomorrow at 2pm", "next Monday at 14:30"
  - Six languages: English, French, German, Japanese, Portuguese, Dutch
  - Auto-detect language from input text
  - Casual (permissive) and Strict parsing modes
- **Daily Notes integration**: wikilink generation with customizable aliases, support for custom folder/format, optional auto-create of missing notes
- **Format presets** (11 built-in): ISO 8601, Locale Short/Long, Verbose, Short Month, 12h/24h time, ISO DateTime, Readable, Standard
- **Internationalization** via Luxon: locale inherits from Obsidian, manual override, configurable week start day
- **Desktop + Mobile** support

### Technical

- 344 automated tests (89.65% coverage)
- TypeScript strict mode
- Build: esbuild (dev) + Rollup (production)
- Bundle size: ~898 KB (includes Luxon + chrono-node)
- Minimum Obsidian version: 1.5.0

### Notes

Pre-1.0 release: the settings API may still evolve based on user feedback before reaching 1.0.

---

## Links

- [GitHub Repository](https://github.com/patrice-bour/obsidian-date-helpers)
- [Issue Tracker](https://github.com/patrice-bour/obsidian-date-helpers/issues)
- [Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions)
