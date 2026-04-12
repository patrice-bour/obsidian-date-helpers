# User Guide

This guide walks you through **Date Helpers** in detail. For a quick overview, see the [README](../README.md).

## Table of contents

1. [Installation](#installation)
2. [Getting started](#getting-started)
3. [Core workflows](#core-workflows)
4. [Natural language parsing](#natural-language-parsing)
5. [Keyboard shortcuts & commands](#keyboard-shortcuts--commands)
6. [Settings reference](#settings-reference)
7. [Integrations](#integrations)
8. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Installation

### Community Plugins (recommended once listed)

1. Open **Settings → Community Plugins** and disable Safe Mode if needed.
2. Click **Browse** and search for `Date Helpers`.
3. Click **Install**, then **Enable**.

### BRAT (beta testing)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. In BRAT, add the beta plugin: `patrice-bour/obsidian-date-helpers`.
3. Enable **Date Helpers** in **Settings → Community Plugins**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/patrice-bour/obsidian-date-helpers/releases).
2. Create the folder `.obsidian/plugins/date-helpers/` in your vault.
3. Copy the three files into that folder.
4. Reload Obsidian and enable the plugin in **Settings → Community Plugins**.

---

## Getting started

After enabling the plugin, you have three ways to trigger the date picker:

- **Trigger character**: type `@@` anywhere in a note.
- **Command palette**: press `Cmd/Ctrl+P` and search for `Date Helpers: …`.
- **Keyboard shortcut**: use one of the default shortcuts (see [below](#keyboard-shortcuts--commands)).

The picker opens a calendar modal with a natural-language input field and format selector. Navigate with the keyboard, press `Enter` to confirm, `Escape` to cancel.

---

## Core workflows

### 1. Insert a date as plain text

1. Place the cursor where you want the date.
2. Type `@@` (or run the command `Insert date as text`).
3. Pick a date in the calendar, or type an expression like `next Friday`.
4. Choose a format preset (ISO, Locale Long, etc.).
5. Press `Enter`.

Result: `2026-04-17` or `April 17, 2026` depending on the selected preset.

### 2. Insert a Daily Note wikilink

1. Type `@@` and switch to the **Insert Daily Note** tab.
2. Pick a date.
3. Press `Enter`.

Result: `[[Journal/2026-04-17|April 17, 2026]]` (path and alias configurable).

### 3. Convert an existing selection

1. Select a date-like text in your note (`tomorrow`, `2025-11-11`, `demain`).
2. Open the command palette and run `Convert selection to date`.
3. Confirm the replacement.

### 4. Cycle through formats

With a date selected, run `Cycle date format` to rotate through the available presets without re-opening the picker.

### 5. Open a Daily Note by date

Run `Open Daily Note`, pick any date, and the plugin opens (or creates) the matching daily note.

---

## Natural language parsing

The NLP field accepts relative expressions, weekdays, and time expressions. The plugin uses [chrono-node](https://github.com/wanasit/chrono) under the hood.

### Examples by language

| Language | Relative | Weekday | Time |
|---|---|---|---|
| English | `today`, `tomorrow`, `3 days ago`, `in 2 weeks` | `next Monday`, `last Friday`, `this Wednesday` | `tomorrow at 2pm`, `Monday 14:30` |
| French | `aujourd'hui`, `demain`, `il y a 3 jours`, `dans 2 semaines` | `lundi prochain`, `vendredi dernier` | `demain à 14h`, `lundi à 14h30` |
| German | `heute`, `morgen`, `vor 3 Tagen` | `nächsten Montag`, `letzten Freitag` | `morgen um 14 Uhr` |
| Japanese | Basic via chrono-node |  |  |
| Portuguese | Basic via chrono-node |  |  |
| Dutch | Basic via chrono-node |  |  |

### Auto-detect

Enable **Auto-detect language** in settings and the plugin will infer the language from each expression. Useful if your notes mix languages.

### Parsing modes

- **Casual** (default) — lenient. Accepts partial or ambiguous expressions and picks the most likely interpretation.
- **Strict** — conservative. Rejects anything that cannot be unambiguously parsed.

### Fallback behavior

When an expression cannot be parsed, you can choose to:
- insert the raw text unchanged,
- show an error notice,
- leave the cursor in place with no insertion.

---

## Keyboard shortcuts & commands

### Default shortcuts

| Command | Shortcut |
|---|---|
| Insert date as text | `Cmd/Ctrl+Shift+T` |
| Insert Daily Note link | `Cmd/Ctrl+Shift+D` |
| Open Daily Note | `Cmd/Ctrl+Shift+O` |

You can override any of these in **Settings → Hotkeys**.

### Date picker navigation

| Key | Action |
|---|---|
| `←` `→` `↑` `↓` | Navigate days |
| `Cmd/Ctrl + ←/→` | Previous / next month |
| `Cmd/Ctrl + ↑/↓` | Previous / next year |
| `Enter` | Confirm selection |
| `Escape` | Cancel |
| `Tab` | Move between calendar / NLP field / format selector |

### Full command list

- `Date Helpers: Insert date as text`
- `Date Helpers: Insert Daily Note link`
- `Date Helpers: Open Daily Note`
- `Date Helpers: Convert selection to date`
- `Date Helpers: Cycle date format`

---

## Settings reference

### General

- **Locale** — format locale for all dates. Defaults to Obsidian's language; override here if needed.
- **Week starts on** — Sunday, Monday, or Saturday.

### Date picker

- **Enable trigger character** — on/off.
- **Trigger character(s)** — default `@@`.

### NLP

- **Enable NLP parsing** — on/off.
- **Auto-detect language** — on/off.
- **Parsing mode** — Casual / Strict.
- **Enabled languages** — check the languages you want to accept.
- **Fallback behavior** — what to do on unparseable input.

### Daily Notes

- **Folder** — where Daily Notes are stored (inherits from core Daily Notes plugin if enabled).
- **Date format** — file naming pattern (e.g. `YYYY-MM-DD`).
- **Alias format** — preset for the wikilink alias.
- **Auto-create missing notes** — on/off.

### Formats

- **Default date format** — preset for Insert date as text.
- **Default time format** — preset for time insertion.
- **Default datetime format** — preset for datetime insertion.

---

## Integrations

### Daily Notes (core plugin)

Date Helpers reads the Daily Notes folder and format from the core Daily Notes plugin when enabled. Insert Daily Note link produces wikilinks that resolve correctly in preview.

### Templater

Date Helpers commands can be invoked from Templater templates via the command palette API. See Templater's documentation on executing commands from templates.

### Tasks

Dates inserted by this plugin are standard ISO or locale strings — the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin parses them natively when used in task lines.

### Dataview

Formatted dates work with Dataview date parsing. For DataviewJS, prefer ISO 8601 format for reliable parsing.

---

## Troubleshooting & FAQ

**Natural language parsing doesn't work.**
Check that NLP is enabled in settings, that your target language is in the **Enabled languages** list, and try toggling **Auto-detect language**.

**The date picker doesn't open when I type `@@`.**
Verify the trigger character is enabled in settings and check it's not intercepted by another plugin. You can change the trigger character or disable it and use the command palette instead.

**Wrong week start day.**
Change **Week starts on** in **Settings → General**.

**Daily Notes links are broken.**
Make sure the core Daily Notes plugin is enabled and that the folder / format match what you configured there.

**Format selector is missing.**
It's only shown in **Insert date as text** and **Insert Daily Note link** modes. The **Open Daily Note** command hides it because it only needs navigation.

**I want a custom format preset.**
Custom presets are planned for a future release. For now, ISO 8601 + locale presets cover most use cases. Let us know your preferred formats via [Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions).

---

## More help

- [Issues](https://github.com/patrice-bour/obsidian-date-helpers/issues) for bug reports
- [Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions) for questions and feature requests
