# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-19

### Added

- An editor selection becomes the wikilink's alias, whether or not it reads as a date. Select `kickoff meeting`, run **Insert daily note link…**, confirm a day: you get `[[2026-08-17|kickoff meeting]]`. A selection that does parse also decides which day the calendar opens on. The picker used to overwrite the selection and throw it away.
- Typing a trigger over a selection keeps the text instead of destroying it. The keystroke used to replace the selected words with a bare `@`; the text stays in the note now and the trigger is written after it, so you see what is held. The selection becomes the link's alias on validation, and what you type after the trigger only names the day. `Esc`, or backspacing the trigger, puts the line back — as long as nothing has been typed after it, so replacing a selection with a literal `@note` still works. `@@` behaves the same and carries the selection into the picker, on the **Link to daily note** tab.
- The format selector's single **Original Text** entry becomes two named sources, **Selected text** and **Typed text**. Each is listed only while it holds text, neither overwrites the other, and the selection is pre-selected when there is one.
- `@` opens an inline suggestion popup instead of doing nothing. Everything typed after it is reparsed on each keystroke — spaces included, so `@next monday at 2pm` works — and the popup lists what it can insert: the formats you pinned, a daily note link carrying your words as its alias, and **Open the picker…**. `Enter` inserts, `Esc` and `Tab` dismiss, and one undo restores what you typed, however long. When nothing parses you get the daily note link and the picker entry, and your text is kept as the alias rather than thrown away.
- Each date and datetime format carries a **Show in the inline suggestion popup** toggle. `ISO 8601` and `Locale long` start pinned; the daily note and picker entries are always there.
- An alias that would break the link is repaired rather than emitted as is: `]]`, `|` and line breaks in a selection become spaces, since Obsidian's wikilinks have no escape and cannot cross a line.

### Changed

- **BREAKING** A trigger now declares what it opens. Each row of **Trigger characters** carries an **Opens** control — **Date picker** or **Inline suggestions** — and the **+** dialog asks for both the sequence and its mode. Length stops deciding anything: `;` can open the picker and `//d` can open the popup, which the old rule made impossible. Your stored triggers are converted on first load by that very rule (one character → inline, two or more → picker), so nothing you already use changes behaviour. **Going back to 0.1.6 or earlier is not clean**: that version accepts the new list without understanding it, so every row shows as `[object Object]` and no trigger fires at all. Recover by deleting the rows and adding one back with **+**, which writes the old shape again — or by removing `triggerCharacters` from the plugin's `data.json` while Obsidian is closed.
- The two settings strings that claimed every trigger opened the picker are rewritten, in English and French. They described one behaviour for a list that always had two.
- A malformed trigger in `data.json` is now dropped on its own instead of resetting the whole list. The list is only refilled with the defaults when nothing in it survives validation — a list you emptied yourself is left empty.
- **BREAKING** No trigger fires in the middle of a word. `blabla@` and `patrice@` stay ordinary text, where the previous rule fired on any trigger ending at the caret.
- **BREAKING** The **Convert selection to date** command is gone. **Insert daily note link…** covers what it did, with or without a selection. Obsidian offers no way to remove a command, so the id disappears on the next plugin load and any hotkey bound to it is dropped by Obsidian itself — rebind it under **Settings → Hotkeys**.
- **BREAKING** A stored `dailyNotesAliasPresetId` of `original-text` migrates to `selected-text` on load. Every other stored value is preserved, and a fresh install now defaults to `selected-text`.
- The three action commands carry a dialog ellipsis — **Insert date as text…**, **Insert daily note link…**, **Open daily note…** — because all three open the picker rather than inserting anything. Their **ids are unchanged**, so existing hotkeys survive. Obsidian freezes a command's name at registration, so the new names reach the palette on the next plugin load.
- The picker's labels move to sentence case, which is Obsidian's convention: **Insert as text**, **Link to daily note**, **Open daily note**, and the settings section headings with them. The command names were already sentence case; the picker was the side that was wrong.

### Removed

- The "Parsed: … → …" and "Could not parse date from: …" notices, which only the removed command raised. A selection that reads as no date is no longer a failure — it is an alias.
- **BREAKING** Three settings leave the tab, and their stored values are dropped: **Show parsing warning**, **Default time format** and **Default datetime format**. Breaking for your configuration, not for what the plugin does — nothing ever read the three. The warning had lost its object with the notices above; the two formats described a design the plugin no longer has, since each preset command carries its own format. **Default date format** stays — it is the one the picker actually reads.
- Eight further keys are stripped from your `data.json` the next time the plugin loads: `nlpLanguages`, `nlpWithDatePicker`, `pickerDefaultPresetId`, `pickerShowFormatSelector`, `nlpUseDateTimePreset`, `nlpDefaultDateTimePresetId`, the legacy `nlpFallbackBehavior`, and `nlpDefaultPresetId` — the second format memory behind the fix below. None had a control in the tab, so there is nothing to see. Supported NLP languages are unchanged — the six are built in, and which one applies still follows your locale and **Auto-detect language**.

### Fixed

- **Trigger characters did nothing on AZERTY keyboards under Windows and Linux, and destroyed the selection.** On those layouts `@` is typed with AltGr, which the system reports as ctrl and alt held together. The plugin treated that as a shortcut and stood aside, so the trigger never fired and text selected under it was overwritten by a bare `@`. AltGr is read as a typed character now. The trade-off, stated plainly: a hotkey bound to `Ctrl+Alt` plus a trigger character competes for the keystroke, and Obsidian's keymap wins — the hotkey fires and the trigger goes silent. Rebind the hotkey or give the trigger another sequence. macOS was never affected, since `@` is a direct key there. This is verified by simulating the AltGr keystroke, not on an AZERTY machine; reports from those users are welcome.
- **`après-demain` inserted tomorrow's date.** Worth checking notes where you used it: the date written was one day early, with no warning. The same applied to `apres-demain`, `après demain`, `aprés-demain` with the wrong accent, `avant-hier soir`, and Japanese `一昨日` and `一昨昨日`, which inserted yesterday. `avant-hier` and `avant hier` inserted nothing at all, as did Portuguese `antes de ontem`, `depois de amanhã` and `depois de amanha`. All of them now resolve to the right day. In **strict mode** only, English was wrong too — `the day after tomorrow` inserted tomorrow — and is fixed with them. The cause was in the date-parsing library, whose French pattern matches `demain` inside `après-demain` because a hyphen counts as a word break; German was never affected, and Dutch compounds remain unsupported.
- Hand-edited fields on a built-in format preset survive a plugin update. When a new version corrects a preset's format string, only that string is replaced now; the type it is filed under, its `builtin` flag and its popup pinning are carried forward. Previously the whole entry was replaced on that path, so those fields were kept or realigned depending on whether the format had changed — which had nothing to do with any of them. Nothing to see unless you edit `data.json` yourself: no part of the settings tab changes a preset's format, type or builtin flag.
- A format chosen while the picker's natural-language field holds text is remembered. The picker wrote your choice to one setting and read another one back, so typing an expression sent the format selector back to `ISO 8601` on every open — including when you reached the picker from the inline popup's **Open the picker…**, which carries your expression with it. There is one memory now, **Default date format**, whether or not an expression is involved.
- A duplicated format preset id no longer costs you a preset. When `data.json` holds several presets under one id, each one is kept and the extras are renamed — `mine`, `mine-1`, `mine-2`. The rename used to be stamped with the clock, and the whole list is checked inside a single millisecond, so the second and third duplicate got the *same* new id and only the last survived the next save. A rename also never takes an id another preset already holds, so a **Default date format** pointing at one of them still points at the same preset. Only reachable if you edit `data.json` by hand or merge two of them.
- An internal fix with nothing to see: when `formatPresets` in `data.json` is empty or is not a list, the plugin falls back to its shipped presets — and it used to hand you the very objects it holds as its own defaults, which the settings tab then writes on. Nothing could read the damage back, because the fall back happens once when the plugin loads, so no release ever mis-saved a preset because of it. The fall back returns copies now, so it stays that way.

## [0.1.6] - 2026-08-16

### Fixed

- The date picker sizes itself. Its one scoped rule put the class on `contentEl`, which *is* the `.modal-content`, so `.unified-date-picker-modal .modal-content` matched no descendant and the picker opened at 526 px — Obsidian's default dialog width — rather than the 360-450 px it declares. The class sits on `modalEl` now, and so does the width, since Obsidian gives `.modal` a fixed width that sizing the content box alone cannot shrink.
- The picker fits a narrow window. Its width floor is `min(360px, 100%)`: a bare 360 px overflows `.modal`, which is itself `min(560px, 80vw)`, below roughly a 493 px viewport. The narrow-viewport override that existed for this case had been targeting `.date-picker-modal`, a class nothing has applied since phase 7.2.
- The picker no longer overflows the window vertically. A 6-week month pushed the footer past the bottom edge and you had to scroll the whole window to reach it; the calendar grid takes the overflow instead, so the footer stays on screen.
- The calendar columns stay under their day labels. The grid scrolls and the label row does not, so on Windows and Linux — where scrollbars take real width — the seven columns slid out from under seven full-width labels, by 13 px at Sunday. Both rows reserve the gutter now. macOS never showed this: its scrollbars overlay.
- The focused day's ring is drawn inside the cell. As an outline it was a stroke on the cell's boundary, and the calendar grid clips horizontally, so on a display running a scaled resolution — where the framebuffer is resampled before it reaches the panel — the right-hand stroke of a Sunday was lost. The keyboard focus ring gets the same treatment, and needed it more: it was offset outwards, where the grid cuts it off outright.
- Keyboard navigation keeps the focus on the day it moves to. Each arrow key redraws the calendar, which destroyed the focused cell; now that the grid scrolls, a day moved out of view was never scrolled back into it.
- The picker's footer lays out on one row. The format `<select>` and the **Today** button sat on a shared baseline with different paddings and no space between them.
- The three action tabs fit the picker. At its declared width they needed 448 px for 418 px and **Open Daily Note** was cut off — invisible while the picker spread to 526 px. The row wraps to a second line instead of clipping, which is also the layout longer labels in other locales reach.
- The published `main.js` is a third of its size — roughly 600 kB against 1 903 530 o in 0.1.5. The production build inlined a sourcemap, so every user downloaded the full plugin source alongside the bundle.

### Removed

- `src/ui/date-picker.css`, a dead 193-line copy imported by nothing. `styles.css` is the only stylesheet shipped, and the copy had already drifted from it.

## [0.1.5] - 2026-08-15

### Added

- The plugin's own interface is translated. Every user-facing string — settings, picker, preset names, notices, errors — goes through the i18n service and follows the **Locale** setting, in English and French. English wording is byte-identical to before, so nothing shifts for an English reader.
- Command names are the one exception: Obsidian fixes a command's name when the plugin registers it and offers no way to rename it, so the palette keeps the previous language until the plugin is reloaded. The user guide says so where it matters.

### Fixed

- The settings tab stopped redrawing itself once you had closed the settings window. Adding or deleting a trigger character wrote to disk without updating the list, and changing **Locale** persisted without touching a single label — both only caught up on a plugin reload. `hide()` latched a teardown flag that only `getSettingDefinitions()` cleared, and Obsidian calls that hook once per declarative tab, never again.
- The date picker opens with the keyboard focus on the selected day. It used to land on an action tab, where Enter reached a button that re-renders the modal rather than the calendar, and where typing went nowhere.

### Documentation

- The README and the user guide were rewritten against the source. They documented default hotkeys that are never registered, calendar keys with the axes swapped, a "Cycle date format" command that does not exist, and four settings that do not exist — while omitting the per-preset insert commands entirely. The guide is now the single reference; both READMEs link to it.
- Recorded what three settings actually do: **Show parsing warning** is stored but never read, and **Default time format** / **Default datetime format** have no reader either. **Default date format** is the picker's remembered format for *Insert as Text*.
- Date Helpers is listed in the community plugin directory since 15 August 2026, so **Browse** finds it — which is what the 0.1.4 note about install instructions was waiting for.
- The user guide now shows the flows it describes: fifteen captures, one per workflow and per settings group. They are produced by a scripted harness (`docs/testing/capture/`) that drives Obsidian over the DevTools protocol, so a capture can be replayed after a UI change or in another locale instead of being re-recorded by hand.

## [0.1.4] - 2026-08-15

No code changes. This release exists to restore distribution.

Since 0.1.1, releases were tagged `v0.1.1`, `v0.1.2` and `v0.1.3`, while Obsidian downloads a plugin from `releases/download/<version>/`, taking the version verbatim from `manifest.json`. Nothing matched, so the community portal could neither scan nor distribute the plugin, and its review stayed pinned to the 0.1.0 scan of 7 May. Every version since is unaffected in itself — it was simply unreachable.

0.1.1, 0.1.2 and 0.1.3 have been republished under bare-version tags, with the same artifacts and the same build provenance attestations. This release is the first cut with the corrected tooling.

### Fixed

- Release tags are now the bare version, which is the path Obsidian requests.
- `npm version` bumps `manifest.json` and `versions.json` again: the hook it called had never been committed, so every release was bumped by hand.
- Installation instructions no longer tell you to search for the plugin in **Browse**, which finds nothing until the directory listing goes through, and the manual install now lists `styles.css` alongside `main.js` and `manifest.json` — without it the date picker and settings render unstyled.

## [0.1.3] - 2026-08-13

The settings tab is now rendered by Obsidian itself, through the declarative settings API. Every Date Helpers setting is therefore reachable from Obsidian's settings search, which the previous renderer did not index.

**This release requires Obsidian 1.13.0 or later.** The community store keeps serving 0.1.2 to earlier versions.

### Changed

- The settings tab declares its settings instead of drawing them: `display()` is gone and `getSettingDefinitions()` takes over. This is Path A of the official migration — a single renderer rather than two maintained side by side.
- `minAppVersion` raised to 1.13.0, since the declarative API does not exist below that version.
- Trigger characters are now an editable list: each row can be deleted individually, including with the Delete/Backspace shortcut, and a `+` button opens an add dialog that keeps the existing validation and stays open on error.
- A locale change is persisted as soon as it is entered — the debounce timer that used to hold unsaved input is gone, which also removes the 0.1.2 limitation about a locale edit lost when a popped-out settings window was force-closed. An invalid locale code now raises an inline error instead of being silently ignored.
- `npm run lint` fails on any warning (`--max-warnings 0`).
- The release workflow now blocks publication until every published asset's GitHub artifact attestation is queryable, not merely produced.

### Fixed

- A locale written in the underscore form (`fr_CA`) was stored as typed while being validated in its normalized form. Luxon rejects it, so every format example and every inserted date read `[Invalid format: …]` until the next restart. Stored values are now normalized on write.
- Two quick deletions in the trigger list could remove a trigger the user had not clicked, and could empty the list entirely — after which the date picker no longer opened on any trigger. Triggers are removed by value, and the "at least one trigger" rule is enforced at the point of mutation.
- A failed save now restores the previous value and reports it, instead of leaving the tab disagreeing with what is stored.
- Unloading the plugin with the settings tab open — a BRAT update, a plugin reload — no longer leaves a pending refresh scheduled against services that are already gone.

### Notes

Known limitation: clearing the locale field and pausing refills it with `auto`. Fixing it requires the settings window's document, which the declarative model does not hand to the tab.

573 tests across 21 suites, coverage 93.3%.

## [0.1.2] - 2026-08-13

Maintenance release. No new features and no settings changes: an internal UI refactor, three bug fixes, and a clean dependency tree.

### Fixed

- Today's date was not highlighted in the calendar whenever the plugin locale differed from the system locale. `isToday()` compared Luxon `DateTime` objects with `.equals()`, which also compares locale metadata, so the highlight silently vanished. Now compared field by field.
- Editing the locale and switching windows or settings tabs could lose the entry, or leave a save running against a closed window. Timers are now scoped to `window` rather than `activeWindow` (which follows focus, so a timer could be cleared against a different window than the one that armed it), the settings tab flushes pending edits when it is hidden instead of discarding them, and a save still in flight can no longer refresh a settings pane that has already been torn down.
- Format selector and calendar rendering no longer depend on `activeWindow` timers in popped-out windows.

### Changed

- The unified date picker modal and the settings tab were split into focused modules (`src/ui/date-picker/`, `src/ui/settings/sections/`). Behaviour is unchanged — this is groundwork for the upcoming declarative settings migration.
- Removed the deprecated `defaultFormat` setting field, which had no runtime reads since the preset system replaced it with `defaultDatePresetId`. The settings migration purges the key from stored data; downgrading re-adds it from the older version's defaults.
- `npm run lint` now reports what the Community Portal's review scan reports: `eslint-plugin-obsidianmd` is installed and active, and the `@typescript-eslint/no-unsafe-*` rule family is no longer disabled. See `CONTRIBUTING.md`.
- Migrated to ESLint 9 flat config (`eslint.config.mjs`), replacing `.eslintrc.json`.
- Resolved every advisory in the dependency tree; `npm audit --audit-level=moderate` reports zero.

### Added

- Test coverage raised to 531 tests across 21 suites, with coverage thresholds now enforced on `main.ts` and the UI layer.

### Notes

Known limitation: Obsidian does not guarantee that a settings tab's `hide()` hook runs when a host window is destroyed abruptly, so a locale edit made in the last few hundred milliseconds before force-closing a popped-out settings window may not persist.

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
