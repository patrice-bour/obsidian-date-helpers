# Date Helpers

[![CI](https://github.com/patrice-bour/obsidian-date-helpers/actions/workflows/ci.yml/badge.svg)](https://github.com/patrice-bour/obsidian-date-helpers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](./CHANGELOG.md)
[![Community Portal](https://img.shields.io/badge/Obsidian-community-7c3aed)](https://community.obsidian.md/plugins/date-helpers)

An Obsidian plugin for writing dates without leaving the keyboard — in six languages, in the format you want, as plain text or as a link to your daily note.

> **Pre-1.0 notice:** The settings API may still evolve before reaching 1.0. See [CHANGELOG.md](./CHANGELOG.md) for what changed between releases.

---

## Type `@`, keep typing

`@` opens a suggestion popup and everything after it is reparsed on every keystroke — spaces included, so `@next monday at 2pm` works. The popup lists what it can insert: the formats you pinned, a link to that day's note, and **Open the picker…** if you would rather see a calendar.

![Typing @next monday: the popup reparses on every keystroke and Enter replaces the whole expression](./docs/media/inline-suggest.gif)

`Enter` inserts. `Esc` and `Tab` dismiss. One undo restores what you typed, however long it was.

When nothing parses, the popup still offers the daily note link and the picker — and keeps your words rather than discarding them, which is what the next section is about.

**On an AZERTY keyboard**, `@` is typed with AltGr, and the plugin reads that as the character it is. One caveat comes with it: an Obsidian hotkey bound to `Ctrl+Alt` plus a trigger character takes the keystroke first, and the trigger goes quiet. Rebind the hotkey, or give the trigger another sequence — see [Troubleshooting](./docs/USER_GUIDE.md#troubleshooting--faq). This path is verified by simulating the AltGr keystroke rather than on an AZERTY machine, so reports from those keyboards are welcome.

## Your selection becomes the alias

Select `kickoff meeting`, run **Insert daily note link…**, confirm a day: you get `[[2026-08-17|kickoff meeting]]`. The selection is never overwritten, whether or not it reads as a date — and when it does read as one, it also decides which day the calendar opens on.

That makes the plugin usable on text you wrote for humans, not only on text shaped like a date.

## The full picker

![Typing @@ opens the picker; confirming replaces the trigger with the date](./docs/media/trigger-at-insert.gif)

`@@` opens the picker, which carries three actions in tabs:

| Action | Output example |
|---|---|
| **Insert date as text…** | `2026-08-17`, or `August 17, 2026` |
| **Insert daily note link…** | `[[Journal/2026-08-17\|August 17, 2026]]` |
| **Open daily note…** | Opens the note, creating it if you asked for that |

Which sequence opens what is yours to decide: every trigger declares its own mode, so `;` can open the picker and `//d` can open the popup. Neither fires in the middle of a word, so `patrice@` stays an email address.

There is also one command per format preset, which inserts straight away without opening anything.

## Natural language, six of them

![Typing "next month" updates the preview and moves the calendar](./docs/media/nlp-preview-next-month.gif)

Relative expressions, weekdays and times are parsed in **English, French, German, Japanese, Portuguese and Dutch**, through [chrono-node](https://github.com/wanasit/chrono). **Auto-detect language** extends your locale to the other five, which matters when a vault mixes languages.

Text the plugin cannot parse is never replaced.

## Formats and locale

Eleven built-in presets cover ISO, locale-aware and verbose renderings of dates, times and datetimes, and each one carries a toggle for whether it appears in the `@` popup. Everything is locale-driven through Luxon: month and weekday names, component order, and the first day of the week. The format you choose is remembered for the next insertion.

The interface itself is translated, not just the dates it writes.

The [User Guide](./docs/USER_GUIDE.md) lists every preset with a rendered example.

## Keyboard first

The plugin registers **no default shortcuts** — Obsidian's community plugin policy leaves that choice to you. Assign your own in **Settings → Hotkeys**, and drive the calendar with arrows, `PageUp`/`PageDown`, `Home` and `t`. The [full key matrix](./docs/USER_GUIDE.md#keyboard-shortcuts--commands) is in the guide.

---

## Requirements

Obsidian **1.13.0** or later, since the settings tab is rendered through Obsidian's declarative settings API. Earlier versions are served 0.1.2 by the community store.

## Installation

Open **Settings → Community Plugins → Browse**, search for `Date Helpers`, install and enable.

BRAT and manual installation are covered in the [User Guide](./docs/USER_GUIDE.md#installation).

## Settings

Locale and week start, feature toggles for the picker and for parsing, the default format, Daily Note alias sources, and the trigger list with a mode per entry. Every setting is reachable from Obsidian's settings search.

The [settings reference](./docs/USER_GUIDE.md#settings-reference) documents each one.

---

## Prior art

The `@` trigger owes its shape to [Natural Language Dates](https://community.obsidian.md/plugins/nldates-obsidian) by Argenos, which has served the Obsidian community for years and showed what date entry in a note could feel like.

Date Helpers pushes elsewhere: six parsing languages rather than one, eleven format presets with a pinning choice per preset, a translated interface, and a single picker covering text insertion, daily note links and opening the note. If you want a small, focused `@today` and nothing more, nldates is the better fit — and it remains the plugin others build their parsing on.

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
