# Architecture Overview

**Status:** describes the code as it stands. Every path, name and signature below was checked
against `src/` — an architecture document that describes an intention rather than the code is
worse than none, which is what the first version of this file turned out to be.

## What the plugin does

One modal — the date picker — reached three ways: the trigger sequence `@@` typed in a note,
a command from the palette, or a preset command that inserts straight away. The picker
resolves a date (calendar, or natural language), formats it with a preset, and hands the
result back to the editor as text, as a daily-note wikilink, or as a navigation.

## Map of the code

```
src/
  main.ts                      Plugin entry: loads settings, builds services, registers
                               commands and the trigger, owns the two picker entry points
  services/
    date-service.ts            now/today/tomorrow/yesterday/fromISO, locale-aware
    formatter-service.ts       DateTime → string, presets, LOCALE_MED* special cases
    nlp-service.ts             chrono-node wrapper: parse, isParseable, language detection
    i18n-service.ts            t(), locale resolution, English fallback
    daily-notes-service.ts     Daily Note paths, wikilinks, creation, opening
    daily-notes-plugin-adapter.ts  The only access to Obsidian's undocumented internals
    translated-error.ts        Marks a failure whose message may be shown to the user
  ui/
    unified-date-picker-modal.ts   Orchestrator: owns nothing but wiring
    date-picker/                   The picker's parts (see below)
    date-picker-suggest.ts         Trigger detection
    settings-tab.ts                Declarative settings tab
    settings/sections/             One builder per settings group
  i18n/
    locales/{en,fr}.json       Translations
    types.ts                   TranslationKey union, maintained by hand
    preset-labels.ts           Built-in preset id → localized name and description
  utils/
    locale.ts                  Obsidian language → plugin locale, validation
    calendar-grid.ts           42-cell month grid, localized day labels
    settings-validator.ts      Trusts nothing from data.json; also migrates it
    settings-migration.ts      Phase 5 → Phase 6 field renames
    constants.ts               Shared constants and the valid-value sets
  settings/defaults.ts         The eleven built-in presets and the default settings
```

There is no `src/commands/` directory and no command classes: commands are registered inline
in `main.ts` as `addCommand({ id, name, editorCallback })`.

## The picker, decomposed

`UnifiedDatePickerModal` mediates; the modules never talk to each other:

| Module | Owns |
|---|---|
| `date-picker-state.ts` | All non-DOM state: selected action, selected preset, view month, focused day, natural-language text |
| `calendar-renderer.ts` | Month header, day labels, the 42-cell grid |
| `nlp-input.ts` | The natural-language field and its preview |
| `format-selector.ts` | The format dropdown, including the two text alias sources |
| `action-selector.ts` | The three action tabs |
| `keyboard-navigation.ts` | 13 bindings, registered on the modal's `Scope` |
| `action-executor.ts` | Runs the selected action for a date |

The keyboard map lives on the modal's scope, so those keys exist only while the picker is
open. The plugin registers **no default hotkey** — Obsidian's community plugin policy leaves
that to the user, through Settings → Hotkeys.

## Three real flows

**Trigger.** `DatePickerSuggest` extends `EditorSuggest`, and the `mode` stored beside each
sequence decides the behaviour — the length decides nothing. `onTrigger` walks back from the
caret: the nearest trigger wins, and at each position the longest one does, so `@@` is never
read as a bare `@`. A `picker` trigger must end at the caret and opens the modal from
`getSuggestions`, which returns an empty list; on confirm the trigger text is replaced by the
result, on cancel it is removed, which is why the modal's `onClose` is wrapped. An `inline`
trigger takes everything between it and the caret as the query, reparses it on each keystroke
and lists the candidate insertions; validating one writes a single `replaceRange` over trigger
and expression together, so one undo restores what was typed. Neither fires after a word
character.

**Command.** `main.ts` → `showUnifiedPicker(editor, action)` → the modal → `executeDateAction`
→ `onSelect` writes at the cursor or over the selection.

**Preset command.** `insertFormattedDate` skips the modal entirely: it formats now with the
preset and inserts, choosing text or wikilink from `lastUsedAction`.

## Settings

The tab is declarative (`getSettingDefinitions`), which is why `minAppVersion` is 1.13.0: the
sections return a tree of definitions and Obsidian renders it, which is what makes every
setting reachable from Obsidian's settings search. `setControlValue` is the single write
funnel; a locale change is the one side effect that rebuilds the tree, on a debounce.

Stored settings are never trusted: `validateSettings` checks types and referenced preset ids,
drops presets whose `type` is not one of date/time/datetime, and performs the migrations —
including stripping the `name`/`description` that versions ≤ 0.1.4 wrote onto built-in
presets.

## Internationalization

Every user-facing string is resolved through `I18nService.t`, including command names, picker
labels, notices and preset labels. Two consequences worth knowing:

- **Built-in presets carry no label.** Their name and description come from
  `settings.presets.formats.<id>.*`, resolved by `preset-labels.ts` at display time. A
  user-defined preset keeps its own words, which are never translated.
- **Command names follow the locale only after a plugin reload.** Obsidian freezes a command's
  name at registration and its public API has no removal, so renaming live would require an
  undocumented internal. Everything else switches immediately.

Interpolated values are inserted verbatim: every consumer assigns `textContent`, and escaping
would show entities to the user. An ESLint rule forbids the HTML sinks that would break that
assumption.

## Dependencies

- **Luxon** — all date arithmetic and formatting.
- **chrono-node** — natural language, imported statically (not lazily), which is most of the
  ~1.8 MB bundle.
- **Obsidian API** — `Plugin`, `PluginSettingTab` with the declarative surface, `Modal`,
  `Scope`, `EditorSuggest`, `Notice`.

`DailyNotesPluginAdapter` holds the codebase's single `@ts-expect-error`: reading the core
Daily Notes plugin's configuration needs `app.internalPlugins`, which is undocumented. Keeping
it behind one typed method is deliberate — the v0.1.0 Community Portal scan raised findings on
exactly this kind of access.

## Tests

673 tests across 27 suites, ~93% coverage. Beyond the unit tests, four structural guardrails
assert what the code *forgot* to declare, which unit tests cannot:

- no user-facing string literal left in `src/` (AST scan, with a reasoned allowlist);
- no translation key that nothing reads;
- English values byte-identical to the literals they replaced, so published screenshots stay true;
- locale parity between `en.json`, `fr.json` and the `TranslationKey` union.

Manual passes are driven against a real Obsidian over the Chrome DevTools Protocol; the
evidence lives in the OpenSpec change that produced it.

## References

- [ADR 0001: Luxon for date management](../decisions/0001_use_luxon_for_date_management.md)
- [ADR 0002: NLP parser hybrid approach](../decisions/0002_nlp_parser_hybrid_approach.md)
- [ADR 0003: Custom lightweight i18n](../decisions/0003_custom_lightweight_i18n.md)
- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
