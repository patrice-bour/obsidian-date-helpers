# Date Helpers

[![CI](https://github.com/patrice-bour/obsidian-date-helpers/actions/workflows/ci.yml/badge.svg)](https://github.com/patrice-bour/obsidian-date-helpers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.4-blue.svg)](./CHANGELOG.md)
[![Community Portal](https://img.shields.io/badge/Obsidian-community-7c3aed)](https://community.obsidian.md/plugins/date-helpers)

An Obsidian plugin that centralizes date-related tools with keyboard-first interaction, natural language parsing, and full internationalization support.

> **Pre-1.0 notice:** The settings API may still evolve before reaching 1.0. See [CHANGELOG.md](./CHANGELOG.md) for what changed between releases.

Type `@@` in a note, pick a date — by calendar or in plain language — and insert it in the format you want.

![Typing @@ opens the picker; confirming replaces the trigger with the date](./docs/media/trigger-at-insert.gif)

## Requirements

Obsidian **1.13.0** or later, since the settings tab is rendered through Obsidian's declarative settings API. Earlier versions are served 0.1.2 by the community store.

## Installation

### Community Plugins (Recommended)

1. Open Obsidian Settings
2. Navigate to **Community Plugins** and disable Safe Mode if needed
3. Click **Browse** and search for "Date Helpers"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/patrice-bour/obsidian-date-helpers/releases)
2. Create folder `.obsidian/plugins/date-helpers/` in your vault
3. Copy the three files into the folder
4. Reload Obsidian and enable the plugin in Settings → Community Plugins

### Using BRAT

For beta testing with automatic updates:

1. Install [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add beta plugin: `patrice-bour/obsidian-date-helpers`
3. Enable Date Helpers in Settings → Community Plugins

---

## What it does

Three actions, chosen from tabs in the picker:

| Action | Output example |
|---|---|
| **Insert date as text** | `2025-11-11`, or `November 11, 2025` |
| **Insert daily note link** | `[[Journal/2025-11-11\|November 11, 2025]]` |
| **Open daily note** | Opens the note, creating it if you asked for that |

Plus **Convert selection to date**, which turns selected text such as `next monday` or `demain` into a formatted date, and one command per format preset that inserts straight away without opening anything.

## Natural language

The picker's text field understands relative expressions, weekdays and times, and previews the result as you type.

![Typing "next month" updates the preview and moves the calendar](./docs/media/nlp-preview-next-month.gif)

Six languages are parsed: English, French, German, Japanese, Portuguese and Dutch — the first three in depth, the rest through [chrono-node](https://github.com/wanasit/chrono) defaults. **Auto-detect language** picks the right one per expression, which matters when a vault mixes languages. Text the plugin cannot parse is never replaced.

## Formats

Eleven built-in presets cover ISO, locale-aware and verbose renderings of dates, times and datetimes. Everything is locale-driven through Luxon: month and weekday names, component order, and the first day of the week. The format you choose is remembered for the next insertion.

The [User Guide](./docs/USER_GUIDE.md) lists every preset with a rendered example.

## Keyboard first

The plugin registers **no default shortcuts** — Obsidian's community plugin policy leaves that choice to you. Assign your own in **Settings → Hotkeys**, and drive the calendar with arrows, `PageUp`/`PageDown`, `Home` and `t`. The [full key matrix](./docs/USER_GUIDE.md#keyboard-shortcuts--commands) is in the guide.

## Settings

Locale and week start, feature toggles for the picker and for parsing, default presets, Daily Note alias formats, and the list of trigger characters. Every setting is reachable from Obsidian's settings search.

![Changing the locale re-renders the examples immediately](./docs/media/settings-locale-live.gif)

The [settings reference](./docs/USER_GUIDE.md#settings-reference) documents each one.

---

## Documentation

- **[User Guide](./docs/USER_GUIDE.md)** — workflows, the full command and key reference, every setting, troubleshooting
- **[Architecture Overview](./docs/arch/0001_architecture_overview.md)** — technical design for contributors

## Support

- **Issues**: [GitHub Issues](https://github.com/patrice-bour/obsidian-date-helpers/issues)
- **Discussions**: [GitHub Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions)
- **Community Portal**: [date-helpers on community.obsidian.md](https://community.obsidian.md/plugins/date-helpers)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines, and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
