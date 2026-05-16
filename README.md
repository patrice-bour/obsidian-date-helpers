# Date Helpers

[![CI](https://github.com/patrice-bour/obsidian-date-helpers/actions/workflows/ci.yml/badge.svg)](https://github.com/patrice-bour/obsidian-date-helpers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)](./CHANGELOG.md)
[![Community Portal](https://img.shields.io/badge/Obsidian-community-7c3aed)](https://community.obsidian.md/plugins/date-helpers)

An Obsidian plugin that centralizes date-related tools with keyboard-first interaction, natural language parsing, and full internationalization support.

> **Pre-1.0 notice:** The settings API may still evolve before reaching 1.0. See [CHANGELOG.md](./CHANGELOG.md) for what changed between releases.

## Installation

### Community Plugins (Recommended)

1. Open Obsidian Settings
2. Navigate to **Community Plugins** and disable Safe Mode if needed
3. Click **Browse** and search for "Date Helpers"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/patrice-bour/obsidian-date-helpers/releases)
2. Create folder `.obsidian/plugins/date-helpers/` in your vault
3. Copy both files into the folder
4. Reload Obsidian and enable the plugin in Settings → Community Plugins

### Using BRAT

For beta testing with automatic updates:

1. Install [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add beta plugin: `patrice-bour/obsidian-date-helpers`
3. Enable Date Helpers in Settings → Community Plugins

---

## Quick Start

### Insert Dates with the Unified Picker

**Via Trigger Character**:
1. Type `@@` anywhere in your note
2. Choose an action tab (Insert Text / Insert Daily Note / Open Note)
3. Navigate the calendar or use natural language
4. Press `Enter` to confirm

**Via Command Palette** (`Cmd/Ctrl+P`):
- **Insert date as text** (`Cmd/Ctrl+Shift+T`)
- **Insert Daily Note link** (`Cmd/Ctrl+Shift+D`)
- **Open Daily Note** (`Cmd/Ctrl+Shift+O`)

### Use Natural Language

Type expressions in the NLP field:
- "tomorrow", "next Monday", "3 days ago"
- "demain", "lundi prochain" (French)
- "morgen", "nächsten Montag" (German)

### Convert Existing Text

1. Select date text in your note (e.g., "tomorrow" or "2025-11-11")
2. Run command: **Convert selection to date**
3. Confirm to replace with formatted date or wikilink

---

## Actions

The plugin provides three flexible actions:

| Action | Description | Output Example |
|--------|-------------|----------------|
| **Insert Date as Text** | Insert formatted plain text | `2025-11-11` or `November 11, 2025` |
| **Insert Daily Note Link** | Create wikilink to Daily Note | `[[Journal/2025-11-11\|November 11, 2025]]` |
| **Open Daily Note** | Navigate to Daily Note | Opens/creates the note |

---

## Language Support

### Natural Language Parsing

| Language | Code | Status | Examples |
|----------|------|--------|----------|
| English | `en` | Full support | "tomorrow", "next Monday", "3 days ago" |
| French | `fr` | Full support | "demain", "lundi prochain", "dans 3 jours" |
| German | `de` | Basic support | "morgen", "nächsten Montag" |
| Japanese | `ja` | Basic support | Via chrono-node |
| Portuguese | `pt` | Basic support | Via chrono-node |
| Dutch | `nl` | Basic support | Via chrono-node |

### Date Formatting

Date formatting supports **all locales** via Luxon:
- Locale-aware month/day names
- Regional date order (DD/MM vs MM/DD)
- Configurable week start day

---

## Configuration

### Settings Overview

| Category | Options |
|----------|---------|
| **General** | Locale, week start day |
| **Date Picker** | Enable/disable, trigger characters |
| **NLP** | Enable/disable, auto-detect language, parsing mode |
| **Daily Notes** | Alias format, auto-create missing notes |
| **Formats** | Default presets for date/time/datetime |

### Configuration Examples

**French Journaler**:
- Locale: `fr-FR`
- Week starts: Monday
- Daily Notes alias: Locale Long → `[[2025-11-11|11 novembre 2025]]`

**Developer (ISO dates)**:
- Default format: ISO 8601
- NLP: Disabled
- Output: `2025-11-11`

**Multilingual**:
- Auto-detect language: Enabled
- NLP languages: EN, FR, DE
- Understands: "tomorrow", "demain", "morgen"

---

## Format Presets

### Date Formats
| Preset | Example |
|--------|---------|
| ISO 8601 | `2025-11-02` |
| Locale Short | `11/2/2025` or `2/11/2025` |
| Locale Long | `November 2, 2025` |
| Verbose | `Monday 3 November 2025` |
| Short Month | `Nov 2, 2025` |

### Time Formats
| Preset | Example |
|--------|---------|
| 24-hour | `14:30` |
| 12-hour | `2:30 PM` |
| 24-hour with seconds | `14:30:45` |

### DateTime Formats
| Preset | Example |
|--------|---------|
| ISO DateTime | `2025-11-02T14:30:45` |
| Readable | `Nov 2, 2025 14:30` |
| Standard | `2025-11-02 14:30:45` |

---

## Keyboard Shortcuts

### Date Picker Navigation

| Key | Action |
|-----|--------|
| `←` `→` `↑` `↓` | Navigate days |
| `Cmd/Ctrl + ←/→` | Navigate months |
| `Cmd/Ctrl + ↑/↓` | Navigate years |
| `Enter` | Confirm selection |
| `Escape` | Cancel |

### Default Commands

| Command | Default Shortcut |
|---------|------------------|
| Insert date as text | `Cmd/Ctrl+Shift+T` |
| Insert Daily Note link | `Cmd/Ctrl+Shift+D` |
| Open Daily Note | `Cmd/Ctrl+Shift+O` |

---

## Troubleshooting

### Natural language not working

1. Check **Enable NLP** is ON in settings
2. Verify your language is supported (EN, FR, DE, JA, PT, NL)
3. Try enabling **Auto-detect language**

### Wrong week start day

Change **Week starts on** in Settings → General Settings

### Daily Notes links broken

1. Enable Daily Notes core plugin
2. Verify folder path matches your Daily Notes configuration
3. Check date format compatibility

### Format selector not visible

- **Insert Text / Insert Daily Note**: Format selector visible
- **Open Daily Note**: Format selector hidden (navigation only)

---

## Support

- **Issues**: [GitHub Issues](https://github.com/patrice-bour/obsidian-date-helpers/issues)
- **Discussions**: [GitHub Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions)
- **Community Portal**: [date-helpers on community.obsidian.md](https://community.obsidian.md/plugins/date-helpers)

## Documentation

- **[User Guide](./docs/USER_GUIDE.md)** — detailed workflows, examples, and configuration tips
- **[Architecture Overview](./docs/arch/0001_architecture_overview.md)** — technical design for contributors

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines, and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
