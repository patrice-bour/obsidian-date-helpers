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

![Typing @ then an expression: the popup lists what it can insert](media/inline-suggest.gif)

- **Inline suggestion**: type `@` and keep typing. What follows is parsed as you go and the popup lists what it can insert — `Enter` inserts the highlighted entry, `Esc` or `Tab` dismisses it. `Space` is an ordinary character here, so `@next monday at 2pm` works.
- **Trigger character**: type `@@` anywhere in a note to open the full picker. The trigger is replaced by whatever you insert.
- **Command palette**: press `Cmd/Ctrl+P` and search for `Date Helpers`.

`@` and `@@` are just the defaults. Each trigger carries a **mode** saying which of the two it opens, and you can change it, rename the sequence, or add your own — see [Trigger characters](#trigger-characters). The length of a sequence has no bearing on what it opens.

Neither trigger fires in the middle of a word: `patrice@` and `blabla@` stay ordinary text.

The plugin registers **no default keyboard shortcuts** — Obsidian's community plugin policy leaves the choice to you. Assign your own in **Settings → Hotkeys**, filtering on `Date Helpers`.

![The picker's three action tabs and its layout](media/modal-tabs-overview.png)

The picker opens a calendar modal with a natural-language field and a format selector. Navigate with the keyboard, press `Enter` to confirm, `Escape` to cancel.

---

## Core workflows

### 1. Insert a date as plain text

1. Place the cursor where you want the date.
2. Type `@@`, or run **Insert date as text…**.
3. Pick a date in the calendar, or type an expression like `next Friday`.
4. Choose a format preset.
5. Press `Enter`.

Result: `2026-04-17`, or `April 17, 2026`, depending on the preset.

![Typing @@ opens the picker; confirming replaces the trigger with the date](media/trigger-at-insert.gif)

The format you pick is remembered, so the next insertion starts from the same one.

![The format selector keeps the last format used](media/format-selector-persistence.gif)

### 2. Insert a Daily Note wikilink

1. Type `@@` and switch to the **Link to daily note** tab.
2. Pick a date.
3. Press `Enter`.

Result: `[[Journal/2026-04-17|April 17, 2026]]`. The path comes from the core Daily Notes plugin; the alias comes from the preset you choose in the settings.

Two entries in the format selector are not formats at all: **Selected text** and **Typed text** reuse your own words rather than a formatted date, so `tomorrow` stays `tomorrow` in the link text. Each is listed only while it has text — the selection you opened the picker with, and whatever you type in the natural-language field — and the selection comes pre-selected when there is one.

![Selecting "kickoff meeting" and confirming a day produces a wikilink aliased with those words](media/selection-as-alias.gif)

### 3. Open a Daily Note by date

Run **Open daily note…**, pick any date, and the plugin opens the matching note — creating it first if **Create daily note if missing** is enabled.

### 4. Turn a selection into a link

1. Select any text in your note — `next monday`, or `kickoff meeting`.
2. Run **Insert daily note link…**.
3. The picker opens with **Selected text** already chosen; confirm a date to replace the selection.

Your selection becomes the link's alias whether or not it reads as a date: `[[2026-08-17|kickoff meeting]]` works exactly like `[[2026-08-17|next monday]]`. A selection that does parse also decides which day the calendar opens on.

> **Changed in 0.2.0** — the separate **Convert selection to date** command is gone; this is what replaced it. If you had a hotkey bound to it, Obsidian drops that binding when the plugin next loads: rebind it to **Insert daily note link…** under **Settings → Hotkeys**.

![Selecting "kickoff meeting" and running Insert daily note link turns it into an aliased wikilink](media/selection-as-alias.gif)

You can also type a trigger straight over the selection, without the command palette. The
keystroke replaces the selected text on screen — Obsidian does that before the plugin sees
anything — but the text is not lost: it becomes the alias, and what you type after the trigger
only names the day.

![Selecting "Kickoff meeting", typing @tomorrow, and choosing the link entry](media/selection-on-trigger.gif)

The bar under the popup says where your text went: **selection** names the text being held,
**date** names what you are typing instead, and **Esc** puts the selection back. Backspacing the
trigger does the same. Both work as long as you have typed nothing after the trigger — once you
have, they leave what is on screen, so replacing a selection with a literal `@note` still works.

`@@` behaves the same way: it opens the full picker with your selection already chosen as the
alias source, on the **Link to daily note** tab — the only tab an alias means anything to.
Cancelling gives the text back. Opening there does not change the tab the picker remembers: your
last used action is whatever you last confirmed.

While a selection is held, the **daily note link leads the list** and is the entry `Enter`
confirms — it is the only one that carries an alias. The plain formats are still there below it,
and confirming one writes the date instead: your selected text is then replaced, and one undo
brings it back.

### 5. Insert a specific format directly

Every format preset also gets its own command — **Insert date: ISO 8601**, **Insert time: 24-hour**, **Insert datetime: Readable**, and so on. These insert immediately at the cursor, with no modal.

They follow the picker's last used action, which is not obvious: after you last confirmed something from the **Link to daily note** or **Open daily note** tab, these commands insert a wikilink to today's note rather than plain text, until you use the **Insert as text** tab again.

These commands are registered when the plugin loads, so **reload the plugin after changing your presets** for the command list to match.

![Running Insert date: ISO 8601 from the palette inserts at the cursor, with no modal](media/commands-preset-insert.gif)

---

## Natural language parsing

The NLP field accepts relative expressions, weekdays and time expressions, and previews the result live as you type. Parsing is powered by [chrono-node](https://github.com/wanasit/chrono).

![Typing "next month" updates the preview and moves the calendar](media/nlp-preview-next-month.gif)

### Examples by language

| Language | Relative | Weekday | Time |
|---|---|---|---|
| English | `today`, `tomorrow`, `3 days ago`, `in 2 weeks`, `the day after tomorrow` | `next Monday`, `last Friday`, `this Wednesday` | `tomorrow at 2pm`, `Monday 14:30` |
| French | `aujourd'hui`, `demain`, `il y a 3 jours`, `dans 2 semaines`, `avant-hier`, `après-demain` | `lundi prochain`, `vendredi dernier` | `demain à 14h`, `lundi à 14h30` |
| German | `heute`, `morgen`, `vor 3 Tagen`, `vorgestern`, `übermorgen` | `nächsten Montag`, `letzten Freitag` | `morgen um 14 Uhr` |
| Japanese | Basic, via chrono-node, plus `一昨日`, `一昨昨日` | | |
| Portuguese | Basic, via chrono-node, plus `antes de ontem`, `depois de amanhã` | | |
| Dutch | Basic, via chrono-node | | |

All six languages are always available — there is no per-language toggle. Coverage beyond English, French and German is whatever chrono-node provides, with one exception: the compounds above are parsed by the plugin itself in French, Portuguese, Japanese and English, because chrono-node matches `demain` inside `après-demain` and answers tomorrow. The German ones come from chrono-node and were always right.

**Two-day compounds it still does not know.** `surlendemain` and `avant-veille` in French, `anteontem` in Portuguese, `おととい`, `明後日` and `あさって` in Japanese, and both Dutch forms — `eergisteren`, `overmorgen` — parse to nothing. Nothing is inserted, so nothing is wrong; write `dans 2 jours` or `il y a 2 jours` instead.

**Auto-detect language** does not replace your locale, it extends it: the language of your locale is tried first, and the other five only if that yields nothing. With it off, only your locale's language is tried — so if your locale is not one of the six, leave auto-detect on, or nothing will parse at all.

### Parsing modes

**Parsing mode** switches chrono between two behaviours:

- **Casual** (default) — lenient. Accepts partial or ambiguous expressions and picks the most likely reading.
- **Strict** — conservative. Rejects anything it cannot parse unambiguously.

### When an expression cannot be parsed

Your text is left untouched — the plugin never replaces input it did not understand.

A selection that reads as no date is not an error either: it becomes the link's alias as it stands.

---

## Keyboard shortcuts & commands

### Date picker navigation

| Key | Action |
|---|---|
| `←` `→` | Previous / next day |
| `↑` `↓` | Previous / next week |
| `PageUp` / `PageDown` | Previous / next month |
| `Mod + ↑` / `Mod + ↓` | Previous / next month |
| `Mod + ←` / `Mod + →` | Previous / next year |
| `Home` | Jump to today |
| `t` | Jump to today, from the calendar |
| `Enter` | Confirm |
| `Escape` | Cancel |

`Mod` is `Cmd` on macOS and `Ctrl` elsewhere. There are no confirm or cancel buttons: the footer holds the format selector and a **Today** button, and you confirm with `Enter` or a click on a day.

![Arrows move the day, PageDown changes month, `t` returns to today, Enter confirms](media/keyboard-calendar-nav.gif)

### Commands

| Command | Available |
|---|---|
| **Insert date as text…** | With a note open in the editor |
| **Insert daily note link…** | With a note open in the editor |
| **Open daily note…** | With a note open in the editor |
| **Insert date: …**, **Insert time: …**, **Insert datetime: …** | One per format preset |

In the palette they are prefixed with the plugin name — `Date Helpers: Insert date: ISO 8601`.

The three ellipses are literal: each opens the picker rather than inserting anything on its own.

![The command palette filtered on Date Helpers](media/date-helpers-commands.png)

The plugin ships no default shortcut. Assign your own under **Settings → Hotkeys**.

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

Presets are read-only in this version: the settings tab lists them so you can see what each one produces. Custom presets are not implemented yet.

Preset names and descriptions follow your **Locale** too — the table above shows the English
names. The names above appear in the command palette as `Insert date: ISO 8601`; in French
the same command reads `Insérer une date : ISO 8601`, after a plugin reload.

---

## Settings reference

Open **Settings → Date Helpers**. Every setting is indexed by Obsidian's settings search since 0.1.3, so you can also find it by name from the search field.

![Searching "picker" in Obsidian's settings search lists the Date Helpers setting](media/settings-search.gif)

The tab renders its groups in this order: **Daily note link settings**, **Text insertion settings**, **General settings**, **Features**, **Trigger characters**, and the list of format presets.

### General settings

| Setting | What it does |
|---|---|
| **Locale** | Language and region for date formatting (`en`, `fr`, `fr-CA`, …). Leave empty to follow Obsidian. It also sets the language of the plugin's own interface — settings, picker, preset names and messages — which ships in English and French. |
| **Week starts on** | First column of the calendar. Independent of the locale. |

![The picker in French: tabs, calendar and footer follow the Locale setting](media/i18n-french-picker.png)

Format examples in the settings re-render as soon as you change the locale, and so does
every other surface — the picker, the preset names, the notices.

![Typing fr-FR in Locale re-renders the tab in French, examples included](media/settings-locale-live.gif)

**Command names are the exception.** Obsidian fixes a command's name when the plugin
registers it and offers no way to rename it afterwards, so the command palette keeps the
previous language until you reload the plugin (disable and re-enable it in **Settings →
Community plugins**, or restart Obsidian).

![The command palette in French, after a plugin reload](media/i18n-french-commands.png)

### Features

| Setting | What it does |
|---|---|
| **Enable date picker** | Shows the calendar picker. Turning it off leaves the commands working. |
| **Enable natural language parsing** | Parses expressions such as `tomorrow` or `next Monday`. |
| **Auto-detect language** | Detects the language of each expression instead of using your locale. |
| **Parsing mode** | Casual or Strict, see [above](#parsing-modes). |

![Turning natural language parsing off hides its two dependent settings](media/nlp-subsettings.gif)

When an expression cannot be parsed, nothing is lost and nothing pops up: the picker's preview
says **Could not parse date** and your text stays as you typed it.

### Text insertion settings

**Default date format** is the preset the picker starts from for *Insert as text*, and what the format selector remembers between insertions. There is no equivalent for time or datetime: each preset command carries its own preset.

### Daily note link settings

| Setting | What it does |
|---|---|
| **Format (with text)** | Alias used when the picker has text to reuse. **Selected text** and **Typed text** are listed first: they reuse your own words rather than a formatted date. |
| **Format (no text)** | Alias preset used otherwise. Text sources are not offered here — there would be no text behind them. |
| **Create daily note if missing** | Creates the note from your Daily Notes template when it does not exist. |

The note's folder and filename format are **not** plugin settings — they come from the core Daily Notes plugin.

### Trigger characters

The list of sequences you can type in a note to insert a date, `@@` and `@` by default. Each row carries an **Opens** control naming what that sequence opens — **Date picker** (the full modal) or **Inline suggestions** (the popup) — and you can change it on any row. Add a trigger with **+**, which asks for both the sequence and its mode; remove one with the delete button on its row or the `Delete`/`Backspace` shortcut. At least one trigger always remains, and a sequence is 5 characters at most.

**Length does not decide the mode.** A one-character `;` can open the picker and a three-character `//d` can open the popup — the combination is yours. Until version 0.2.0 the rule was implicit and invisible: two characters or more meant the picker, one meant the popup. Your existing triggers keep exactly the behaviour they had, because that same rule is what converts them on first load.

Each date and datetime format also carries a **Show in the inline suggestion popup** toggle in the format list below: it decides which formats the popup offers. The daily note entry and **Open the picker…** are always there, whatever you pin.

**On a keyboard where a trigger needs AltGr.** On AZERTY layouts under Windows and Linux, `@` is
typed with AltGr, which the system reports as ctrl and alt held together. Date Helpers reads that
as a typed character, so the trigger works. The consequence: if you bind an Obsidian hotkey to
`Ctrl+Alt` plus that same character, the hotkey wins and the trigger stops firing. Nothing is
lost — the trigger simply goes silent. Rebind the hotkey, or give the trigger a different
sequence.

**Reload the plugin after changing this list.** The triggers are read when the plugin loads, so a sequence you add, remove or reassign takes effect on the next reload (`Cmd/Ctrl+R`), not immediately. The **Show in the popup** toggles, by contrast, apply straight away.

![Adding //d with the + button, then removing it from its row](media/trigger-list.gif)

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

**Typing an email address opens a popup.**
It should not: a trigger placed right after a word character is inert, so `patrice@` inserts a plain `@`. If a popup does open there, report it — that is a bug.

**The inline popup lists nothing but two entries.**
That is what it does when your expression reads as no date: a daily note link carrying what you typed as its alias, and **Open the picker…**. Plain formats are left out on purpose — they cannot carry your words.

**Nothing happens when I type `@` on my AZERTY keyboard.**
Check **Settings → Hotkeys** for a shortcut bound to `Ctrl+Alt+@`, from Obsidian or from another
plugin. On AZERTY layouts `@` is AltGr+0, which the system reports as ctrl and alt held together,
so such a hotkey takes the keystroke first. Rebind it, or give the trigger a different sequence.
Versions up to 0.1.6 could not fire an AltGr trigger at all and destroyed the selection instead;
that is fixed from 0.2.0 on.

**My preset commands don't match my presets.**
Preset commands are registered when the plugin loads. Reload the plugin after changing presets.

**Wrong week start day.**
Change **Week starts on** in the plugin settings. It is independent of your locale.

**Daily Notes links are broken.**
Make sure the core Daily Notes plugin is enabled: the folder and filename format come from it, not from Date Helpers.

**The format selector is missing.**
It appears in **Insert as text** and **Link to daily note**. The **Open daily note** tab hides it, since opening a note needs no format.

**I want a custom format preset.**
Not implemented yet. Tell us which format you need in [Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions).

---

## More help

- [Issues](https://github.com/patrice-bour/obsidian-date-helpers/issues) for bug reports
- [Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions) for questions and feature requests
