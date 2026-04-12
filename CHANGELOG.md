# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
