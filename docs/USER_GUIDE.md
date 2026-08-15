# User Guide

This guide walks you through **Date Helpers** in detail. For a quick overview, see the [README](../README.md).

## Table of contents

1. [Installation](#installation)
2. [Getting started](#getting-started)
3. [Core workflows](#core-workflows)
4. [Natural language parsing](#natural-language-parsing)
5. [Keyboard shortcuts & commands](#keyboard-shortcuts--commands)
6. [Format presets](#format-presets)
7. [Settings reference](#settings-reference)
8. [Integrations](#integrations)
9. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Installation

### Community Plugins (recommended)

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

Date Helpers requires **Obsidian 1.13.0 or later**. Earlier versions are served 0.1.2 by the community store.

---

## Getting started

There are two ways to open the date picker:

- **Trigger character**: type `@@` anywhere in a note. The trigger is replaced by whatever you insert.
- **Command palette**: press `Cmd/Ctrl+P` and search for `Date Helpers`.

The plugin registers **no default keyboard shortcuts** — Obsidian's community plugin policy leaves the choice to you. Assign your own in **Settings → Hotkeys**, filtering on `Date Helpers`.

![The picker's three action tabs and its layout](media/modal-tabs-overview.png)

The picker opens a calendar modal with a natural-language field and a format selector. Navigate with the keyboard, press `Enter` to confirm, `Escape` to cancel.

---

## Core workflows

### 1. Insert a date as plain text

1. Place the cursor where you want the date.
2. Type `@@`, or run **Insert date as text**.
3. Pick a date in the calendar, or type an expression like `next Friday`.
4. Choose a format preset.
5. Press `Enter`.

Result: `2026-04-17`, or `April 17, 2026`, depending on the preset.

![Typing @@ opens the picker; confirming replaces the trigger with the date](media/trigger-at-insert.gif)

The format you pick is remembered, so the next insertion starts from the same one.

![The format selector keeps the last format used](media/format-selector-persistence.gif)

### 2. Insert a Daily Note wikilink

1. Type `@@` and switch to the **Insert Daily Note** tab.
2. Pick a date.
3. Press `Enter`.

Result: `[[Journal/2026-04-17|April 17, 2026]]`. The path comes from the core Daily Notes plugin; the alias comes from the preset you choose in the settings.

One alias preset is special: **Original Text** reuses what you typed rather than a formatted date, so `tomorrow` stays `tomorrow` in the link text.

![Typing "tomorrow" produces a wikilink whose alias is the original text](media/daily-note-original-text.gif)

### 3. Open a Daily Note by date

Run **Open daily note**, pick any date, and the plugin opens the matching note — creating it first if **Create Daily Note if missing** is enabled.

### 4. Convert an existing selection

1. Select date-like text in your note (`tomorrow`, `2025-11-11`, `demain`).
2. Run **Convert selection to date**.
3. The picker opens with that date already parsed; confirm to replace the selection.

The command only appears in the palette when text is selected.

### 5. Insert a specific format directly

Every format preset also gets its own command — **Insert date: ISO 8601**, **Insert time: 24-hour**, **Insert datetime: Readable**, and so on. These insert immediately at the cursor, with no modal.

![Running a preset command inserts the date without opening the picker](media/commands-preset-insert.gif)

These commands are registered when the plugin loads, so **reload the plugin after changing your presets** for the command list to match.

---

## Natural language parsing

The NLP field accepts relative expressions, weekdays and time expressions, and previews the result live as you type. Parsing is powered by [chrono-node](https://github.com/wanasit/chrono).

![Typing "next month" updates the preview and moves the calendar](media/nlp-preview-next-month.gif)

### Examples by language

| Language | Relative | Weekday | Time |
|---|---|---|---|
| English | `today`, `tomorrow`, `3 days ago`, `in 2 weeks` | `next Monday`, `last Friday`, `this Wednesday` | `tomorrow at 2pm`, `Monday 14:30` |
| French | `aujourd'hui`, `demain`, `il y a 3 jours`, `dans 2 semaines` | `lundi prochain`, `vendredi dernier` | `demain à 14h`, `lundi à 14h30` |
| German | `heute`, `morgen`, `vor 3 Tagen` | `nächsten Montag`, `letzten Freitag` | `morgen um 14 Uhr` |
| Japanese | Basic, via chrono-node | | |
| Portuguese | Basic, via chrono-node | | |
| Dutch | Basic, via chrono-node | | |

All six languages are always available — there is no per-language toggle. **Auto-detect language** decides which one to apply to each expression, which is what you want if your notes mix languages. With auto-detect off, expressions are parsed in the language of your configured locale.

### Parsing modes

**Parsing mode** switches chrono between two behaviours:

- **Casual** (default) — lenient. Accepts partial or ambiguous expressions and picks the most likely reading.
- **Strict** — conservative. Rejects anything it cannot parse unambiguously.

### When an expression cannot be parsed

Your text is left untouched — the plugin never replaces input it did not understand. Enable **Show parsing warning** if you also want a notice when that happens.

---

## Keyboard shortcuts & commands

### Date picker navigation

| Key | Action |
|---|---|
| `←` `→` `↑` `↓` | Move by day |
| `PageUp` / `PageDown` | Previous / next month |
| `Mod + ↑` / `Mod + ↓` | Previous / next month |
| `Mod + ←` / `Mod + →` | Previous / next year |
| `Home` | Jump to today |
| `t` | Jump to today, from the calendar |
| `Enter` | Confirm |
| `Escape` | Cancel |

`Mod` is `Cmd` on macOS and `Ctrl` elsewhere.

### Commands

| Command | Available |
|---|---|
| **Insert date as text** | Always |
| **Insert daily note link** | Always |
| **Open daily note** | Always |
| **Convert selection to date** | Only with an active selection |
| **Insert date: …**, **Insert time: …**, **Insert datetime: …** | One per format preset |

![The full command list in the palette](media/date-helpers-commands.png)

None of them has a default shortcut; assign your own in **Settings → Hotkeys**.

---

## Format presets

Eleven presets ship with the plugin. Examples are rendered for 2 November 2025, 14:30:45, in an English locale — locale-aware presets follow your **Locale** setting.

| Type | Preset | Example |
|---|---|---|
| Date | ISO 8601 | `2025-11-02` |
| Date | Locale short | `11/2/2025` |
| Date | Locale long | `November 2, 2025` |
| Date | Verbose | `Sunday 2 November 2025` |
| Date | Short month | `Nov 2, 2025` |
| Time | 24-hour | `14:30` |
| Time | 12-hour | `2:30 PM` |
| Time | 24-hour with seconds | `14:30:45` |
| DateTime | ISO datetime | `2025-11-02T14:30:45` |
| DateTime | Readable | `Nov 2, 2025 14:30` |
| DateTime | Standard | `2025-11-02 14:30:45` |

Presets are read-only in this version: the settings tab lists them so you can see what each one produces, and the three **Default … format** dropdowns choose which is used. Custom presets are not implemented yet.

---

## Settings reference

Open **Settings → Date Helpers**. Every setting is indexed by Obsidian's settings search since 0.1.3, so you can also find it by name from the search field.

### General

| Setting | What it does |
|---|---|
| **Locale** | Language and region for date formatting (`en`, `fr`, `fr-CA`, …). Leave empty to follow Obsidian. |
| **Week starts on** | First column of the calendar. |

Format examples in the settings re-render as soon as you change the locale.

![Changing the locale re-renders the examples immediately](media/settings-locale-live.gif)

### Features

| Setting | What it does |
|---|---|
| **Enable date picker** | Shows the calendar picker. Turning it off leaves the commands working. |
| **Enable natural language parsing** | Parses expressions such as `tomorrow` or `next Monday`. |
| **Auto-detect language** | Detects the language of each expression instead of using your locale. |
| **Parsing mode** | Casual or Strict, see [above](#parsing-modes). |
| **Show parsing warning** | Notifies you when an expression cannot be parsed. Your text is preserved either way. |

### Text formats

**Default date format**, **Default time format** and **Default datetime format** pick the preset used by the corresponding preset commands.

### Daily Notes

| Setting | What it does |
|---|---|
| **Format (with text)** | Alias preset used when the picker has natural-language text to reuse. |
| **Format (no text)** | Alias preset used otherwise. |
| **Create Daily Note if missing** | Creates the note from your Daily Notes template when it does not exist. |

The note's folder and filename format are **not** plugin settings — they come from the core Daily Notes plugin.

### Trigger characters

The list of sequences that open the picker, `@@` by default. Add one with **+**, remove one with the delete button on its row or the `Delete`/`Backspace` shortcut. At least one trigger always remains.

---

## Integrations

### Daily Notes (core plugin)

Date Helpers reads the folder and filename format from the core Daily Notes plugin, so the wikilinks it inserts resolve like the ones you write by hand.

### Tasks

Inserted dates are plain ISO or locale strings, which the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin parses natively in task lines. Use the ISO 8601 preset for due dates.

### Dataview

Formatted dates work with Dataview's date parsing. Prefer ISO 8601 in DataviewJS, where parsing is strictest.

### Templater

Date Helpers exposes Obsidian commands, so a Templater template can invoke them through `app.commands.executeCommandById()` — for example `date-helpers:insert-date-iso8601`. Commands that open the picker wait for your confirmation, which makes them a poor fit for unattended templates; the preset commands, which insert straight away, work better.

---

## Troubleshooting & FAQ

**Natural language parsing doesn't work.**
Check that **Enable natural language parsing** is on. If your expression is in a language other than your locale, turn on **Auto-detect language**. If it is a partial expression, **Parsing mode** may be set to Strict.

**The date picker doesn't open when I type `@@`.**
Verify **Enable date picker** is on, and that no other plugin intercepts the sequence. You can add a different trigger with **+** and delete the one that clashes — as long as one remains — or ignore the trigger entirely and use the command palette.

**My preset commands don't match my presets.**
Preset commands are registered when the plugin loads. Reload the plugin after changing presets.

**Wrong week start day.**
Change **Week starts on** in the plugin settings. It is independent of your locale.

**Daily Notes links are broken.**
Make sure the core Daily Notes plugin is enabled: the folder and filename format come from it, not from Date Helpers.

**The format selector is missing.**
It appears in **Insert Text** and **Insert Daily Note**. The **Open Note** tab hides it, since opening a note needs no format.

**I want a custom format preset.**
Not implemented yet. Tell us which format you need in [Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions).

---

## More help

- [Issues](https://github.com/patrice-bour/obsidian-date-helpers/issues) for bug reports
- [Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions) for questions and feature requests
