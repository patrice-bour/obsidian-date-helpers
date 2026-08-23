# Date Helpers

[![CI](https://github.com/patrice-bour/obsidian-date-helpers/actions/workflows/ci.yml/badge.svg)](https://github.com/patrice-bour/obsidian-date-helpers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](./CHANGELOG.md)
[![Community Portal](https://img.shields.io/badge/Obsidian-community-7c3aed)](https://community.obsidian.md/plugins/date-helpers)

An Obsidian plugin that puts a **date picker**, **eleven date formats** and **daily note links** one or two **keystrokes away**. It reads six languages.

You are mid-sentence and a date gets in the way: *next monday* — which date is that, again? 
Type `@next monday`, press `Enter`, and the date lands in the format you chose, as text or as a link to that day's note. 

![Typing @next monday: the popup reparses on every keystroke and Enter replaces the whole expression](./docs/media/inline-suggest.gif)

Writing `[[Journal/2026-08-17|kickoff meeting]]` by hand, pipe and all, is the other chore: select your words, run one command, confirm a day, and the plugin writes that link around them.

> **New to Obsidian?** A **daily note** is the one-note-per-day journal of a core plugin, and a **wikilink** like `[[2026-08-17|kickoff meeting]]` is a link that shows an alias (`kickoff meeting`) instead of its target (`2026-08-17`). Date Helpers writes both for you.

## Installation

Date Helpers needs Obsidian **1.13.0** or later (its settings tab is rendered through the declarative settings API introduced in 1.13.0). 

1. Open **Settings → Community Plugins → Browse**, search for `Date Helpers`, install and enable.
2. Open any note and type `@next monday`. The popup lists what it can insert; `Enter` replaces the whole expression with the date, `Esc` dismisses.
3. Prefer a calendar? Type `@@` for the full picker.

BRAT and manual installation are covered in the [User Guide](./docs/USER_GUIDE.md#installation).

*On an earlier version, the community store serves you 0.1.2; updating Obsidian gives you the plugin this page describes.*

## What you can do

Date Helpers gives you:

- a **date picker**, opened by the default `@@` trigger or from the command palette
- and, without leaving the keyboard:
  - **dates read from plain language**, in six of them
  - a **date rendered in any of eleven formats**
  - your **own words kept as a daily note link's alias**, or written as plain text

### The full picker

![Typing @@ opens the picker; confirming replaces the trigger with the date](./docs/media/trigger-at-insert.gif)

`@@` — a trigger set by default — opens the picker: a calendar, a natural-language field, a format selector, and three tabs:

- **Insert as text** — `2026-08-17`, or `August 17, 2026`, whichever preset you pick
- **Link to daily note** — `[[Journal/2026-08-17|August 17, 2026]]`
- **Open daily note** — the daily note itself, opened, and created first if you enabled that

Triggers are yours to shape: each one declares whether it opens the picker or the popup, so `;;` can open the picker and `//d` the popup.

**Neither fires in the middle of a word**, so `any.pattern@` stays an email address while `@` is a trigger.

There is also <u>one command per format preset</u> — **Insert date: ISO 8601**, for instance — which inserts straight away without opening anything.

The [User Guide](./docs/USER_GUIDE.md#core-workflows) walks through each workflow, capture by capture.

### Type `@`, keep typing

`@` — the other trigger set by default — opens a suggestion popup, and everything after it is reparsed on every keystroke, spaces included, so `@next monday at 2pm` works. The popup groups what it can insert: the formats you picked for it (`ISO 8601` and `Locale long` out of the box), and a link to that day's daily note.

`Enter` inserts. `Esc` dismisses. `Tab` opens the picker, and so does the link in the popup's footer. One undo restores what you typed, however long it was.

When nothing parses, the popup still offers the daily note link and the picker — **your words become the link's alias** rather than being discarded.

Adding triggers and choosing what the popup lists: [Trigger characters](./docs/USER_GUIDE.md#trigger-characters) in the guide.

### Your selection becomes the alias

Select `kickoff meeting`, type the `@` trigger, then pick a preset or keep typing a natural-language date. The popup offers a wikilink that points at the daily note of that date and carries your selected words as its alias.

![Selecting words, typing the @ trigger and confirming: the selection stays as the link's alias](./docs/media/selection-on-trigger.gif)

The command **Insert daily note link…** does the same over a selection: confirm a day (e.g. 2026-08-17), and the selection is replaced by `[[2026-08-17|kickoff meeting]]`.

![Selecting "kickoff meeting" and confirming a day produces a wikilink aliased with those words](./docs/media/selection-as-alias.gif)

**The swap is one edit**: cancelling leaves the note untouched, and a single undo brings your text back. And when the selection does read as a date, it also decides which day the calendar opens on.

That makes the plugin usable on text you wrote for humans, not only on text shaped like a date.

Step by step, variants included: [Turn a selection into a link](./docs/USER_GUIDE.md#core-workflows) in the guide.

### Natural language, six of them

![Typing "next month" updates the preview and moves the calendar](./docs/media/nlp-preview-next-month.gif)

Relative expressions, weekdays and times are parsed in **English, French, German, Japanese, Portuguese and Dutch**, through [chrono-node](https://github.com/wanasit/chrono): `@demain à 14h` and `@nächsten Montag um 14 Uhr` work just like `@next monday at 2pm`.

The six do not cover the same ground. All of them read relative days, weekdays and times. Portuguese and Japanese read neither the `next`/`last` modifier nor `in N days`: `sexta-feira passada` gives you today, not last Friday. On those two, prefer the calendar for a past or future week.

**Auto-detect language** extends your locale to the other five — your locale's language is always tried first — which matters when a vault mixes languages.

Text the plugin cannot parse is never discarded, and never replaced by a date it invented.

The plugin's own interface — settings tab, picker and popup — is translated into **English and French**. The four other languages are read, not yet spoken:

![The picker in French: tabs, calendar and footer follow the Locale setting](./docs/media/i18n-french-picker.png)

The [User Guide](./docs/USER_GUIDE.md#natural-language-parsing) has examples for each language.

### Formats and locale

Dates come out the way you would write them yourself: eleven built-in presets cover ISO, locale-aware and verbose renderings of dates, times and datetimes, and month names, weekday names and component order follow your locale, through Luxon. 

The first day of the week is a setting of its own, and the format you choose is remembered for the next insertion.

The [User Guide](./docs/USER_GUIDE.md#format-presets) lists every preset with a rendered example.

### Keyboard first

Three things share the keyboard here, and they do not follow the same rule.

**Two triggers are set for you**: `@@` opens the picker, `@` opens the popup. Both can be changed, removed or joined by others in the settings.

**No hotkey is set for you** — Obsidian's community plugin policy leaves that choice to the user. Assign your own to any of the plugin's commands in **Settings → Hotkeys**.

**The calendar keys are fixed.** They are neither configurable nor extensible:

| Key | What it does |
| --- | --- |
| `←` `→` `↑` `↓` | move by one day, or by one week |
| `PageUp` / `PageDown`, or `Mod+↑` / `Mod+↓` | previous or next month |
| `Mod+←` / `Mod+→` | previous or next year |
| `Home`, or `t` | back to today |
| `Enter` | confirm |

The arrows and `t` give way to the natural-language field: while you type there, they edit your text instead.

![Arrows move the day, PageDown changes month, `t` returns to today, Enter confirms](./docs/media/keyboard-calendar-nav.gif)

The [full key matrix](./docs/USER_GUIDE.md#keyboard-shortcuts--commands) is in the guide.

## Settings

Open **Settings → Date Helpers**. The tab groups its settings like this:

| Group | What it holds |
| --- | --- |
| **Daily note link** | Alias formats, **Create daily note if missing** |
| **Text insertion** | **Default date format** |
| **General** | **Locale**, **Week starts on** |
| **Features** | **Enable date picker**, **Enable natural language parsing**, **Auto-detect language**, **Parsing mode** |
| **Trigger characters** | The sequences you type, and what each one opens |
| **Available format presets** | One row per preset, with its **Show in the popup** toggle |

Most of them are reachable from Obsidian's settings search; the [settings reference](./docs/USER_GUIDE.md#settings-reference) documents each one.

## Privacy and permissions

Date Helpers edits the note you are working in, at your cursor or over your selection. Beyond that, it saves its own settings (`data.json` in its plugin folder) and, when you asked for a daily note, creates that note — missing parent folders included. Parsing (chrono-node) and formatting (Luxon) run locally: the plugin makes no network connections and collects no telemetry. Daily-note folder and filename come from the core Daily Notes plugin, so the links it inserts resolve like the ones you write by hand.

The [security policy](./SECURITY.md) states this scope and how to report anything that contradicts it.

## Documentation

- **[User Guide](./docs/USER_GUIDE.md)** — workflows, the full command and key reference, every setting
- **[Integrations](./docs/USER_GUIDE.md#integrations)** — how Date Helpers works with the core Daily Notes plugin
- **[Troubleshooting & FAQ](./docs/USER_GUIDE.md#troubleshooting--faq)** — when a trigger stays quiet or an expression won't parse
- **[Architecture Overview](./docs/arch/0001_architecture_overview.md)** — technical design for contributors

## Prior art

The `@` trigger owes its shape to [Natural Language Dates](https://community.obsidian.md/plugins/nldates-obsidian) by Argenos, which has served the Obsidian community for years and showed what date entry in a note could feel like. Date Helpers pushes elsewhere — six parsing languages, eleven presets, a translated interface, one picker for text, links and opening the note. If you want a small, focused `@today`, nldates may be a better fit.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and what changed between releases.

## Support

- **Issues**: [GitHub Issues](https://github.com/patrice-bour/obsidian-date-helpers/issues)
- **Discussions**: [GitHub Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions)
- **Community Portal**: [date-helpers on community.obsidian.md](https://community.obsidian.md/plugins/date-helpers)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines, and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE)
