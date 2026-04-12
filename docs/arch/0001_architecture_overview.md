# Architecture Overview

**Version:** 1.0
**Date:** 2025-11-02
**Status:** Living document

## Introduction

This document provides a high-level overview of the Date Helpers plugin architecture. It describes the core components, their interactions, and key design principles.

## Design Principles

1. **Modularity**: Clear separation of concerns (parsing, formatting, UI, settings)
2. **Extensibility**: Easy to add new date formats, languages, and parsing rules
3. **Type Safety**: Leverage TypeScript for compile-time guarantees
4. **Performance**: Lazy loading of heavy components (chrono-node, calendar UI)
5. **Testability**: Pure functions where possible, dependency injection for services

## System Context

```
┌─────────────────────────────────────────────────────────────┐
│                      Obsidian App                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Date Helpers Plugin                          │   │
│  │                                                      │   │
│  │  ┌─────────────┐  ┌──────────────┐   ┌───────────┐   │   │
│  │  │  Commands   │  │  Date Picker │   │  Settings │   │   │
│  │  └──────┬──────┘  └──────┬───────┘   └─────┬─────┘   │   │
│  │         │                │                 │         │   │
│  │         └────────┬───────┴─────────────────┘         │   │
│  │                  │                                   │   │
│  │         ┌────────▼────────────────┐                  │   │
│  │         │   Core Services         │                  │   │
│  │         │  - DateService          │                  │   │
│  │         │  - ParserService        │                  │   │
│  │         │  - FormatterService     │                  │   │
│  │         │  - I18nService          │                  │   │
│  │         └────────┬────────────────┘                  │   │
│  │                  │                                   │   │
│  │         ┌────────▼────────────────┐                  │   │
│  │         │   External Libraries    │                  │   │
│  │         │  - Luxon                │                  │   │
│  │         │  - chrono-node          │                  │   │
│  │         └─────────────────────────┘                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Layer 1: Obsidian API Integration

**Main Plugin Class** (`src/main.ts`)
- Entry point, implements Obsidian's `Plugin` interface
- Lifecycle management (load, unload)
- Registers commands, settings tab, event handlers
- Dependency injection container

**Commands** (`src/commands/`)
- Thin adapters to Obsidian command system
- Delegate logic to services
- Handle editor context (cursor, selection)

Examples:
- `InsertDateCommand`: Open picker or insert current date
- `ParseSelectionCommand`: Parse selected text to date
- `CycleFormatCommand`: Cycle through format presets

**Settings Tab** (`src/ui/settings.ts`)
- Obsidian settings interface
- Format customization
- Locale override
- Trigger character configuration

### Layer 2: Core Services

**DateService** (`src/services/date-service.ts`)
- Central facade for date operations
- Coordinates between Parser, Formatter, and Luxon
- Handles timezone logic
- Pure functions for testability

```typescript
interface DateService {
  now(): DateTime;
  parse(input: string, locale?: string): DateTime | null;
  format(date: DateTime, format: string): string;
  relative(baseDate: DateTime, offset: RelativeOffset): DateTime;
}
```

**ParserService** (`src/services/parser-service.ts`)
- Orchestrates parsing strategies:
  1. ISO 8601 direct parsing (fast path)
  2. Locale-specific formats (Luxon)
  3. Natural language (chrono-node)
  4. Custom patterns
- Returns `ParseResult` with confidence score

```typescript
interface ParserService {
  parse(input: string, context: ParseContext): ParseResult;
  registerCustomPattern(pattern: CustomPattern): void;
}

interface ParseResult {
  date: DateTime | null;
  confidence: number; // 0-1
  source: 'iso' | 'locale' | 'nlp' | 'custom';
}
```

**FormatterService** (`src/services/formatter-service.ts`)
- Centralizes date-to-string conversion
- Manages format presets
- Handles locale-specific formatting via Luxon

```typescript
interface FormatterService {
  format(date: DateTime, format: FormatString | FormatPreset): string;
  getPresets(): FormatPreset[];
  registerPreset(preset: FormatPreset): void;
}
```

**I18nService** (`src/services/i18n-service.ts`)
- UI string translations
- Locale detection and resolution
- Fallback logic
- Type-safe translation keys

```typescript
interface I18nService {
  t(key: TranslationKey, params?: Record<string, unknown>): string;
  getCurrentLocale(): string;
  setLocale(locale: string): void;
}
```

### Layer 3: UI Components

**DatePicker** (`src/ui/date-picker.ts`)
- Modal calendar interface
- Keyboard navigation (arrow keys, Enter, Esc)
- Localized display (month/day names, week start)
- Lazy-loaded (only when needed)

**FormatCycler** (`src/ui/format-cycler.ts`)
- Preview different formats for selected date
- Quick-select via keyboard shortcuts
- Remembers last used format

### Layer 4: Utilities

**Locale Manager** (`src/utils/locale.ts`)
- Locale detection (Obsidian → plugin settings → fallback)
- Locale validation
- Extended locale data (week start, ISO weeks, etc.)

**Pattern Registry** (`src/utils/patterns.ts`)
- Custom regex patterns for parsing
- Language packs (JSON)
- Pattern priority and conflict resolution

**Validators** (`src/utils/validators.ts`)
- Date range validation
- Format string validation
- Input sanitization

## Data Flow

### Scenario 1: Insert Date via Command

```
User: Ctrl+Shift+D
  → Command: InsertDateCommand
    → Service: DateService.now()
      → Library: Luxon.DateTime.now()
    → Service: FormatterService.format(date, userFormat)
      → Library: Luxon.toFormat()
  → Obsidian: editor.replaceSelection(formatted)
```

### Scenario 2: Parse Selected Text

```
User: Select "tomorrow" → Ctrl+Shift+P
  → Command: ParseSelectionCommand
    → Service: ParserService.parse("tomorrow", context)
      → Try ISO 8601: fail
      → Try Luxon formats: fail
      → Try chrono-node: success!
        → Library: chrono.parse("tomorrow")
        → Convert to Luxon: DateTime.fromJSDate()
    → Service: FormatterService.format(parsed, userFormat)
  → Obsidian: editor.replaceSelection(formatted)
```

### Scenario 3: Date Picker

```
User: @@ (trigger)
  → Command: OpenDatePickerCommand
    → UI: DatePicker.open()
      → Service: I18nService.t('months.january', etc.)
      → Service: LocaleManager.getWeekStart()
    → User selects date in calendar
    → Service: FormatterService.format(selected, userFormat)
  → Obsidian: editor.replaceRange(formatted, triggerPos)
```

## Configuration

**Plugin Settings** (`src/types/settings.ts`)
```typescript
interface DateHelpersSettings {
  // Formats
  defaultFormat: string;
  formatPresets: FormatPreset[];

  // Locale
  locale: string | 'auto';
  weekStart: 0 | 1 | 6; // Sun, Mon, Sat

  // Triggers
  triggerCharacters: string[];

  // Features
  enableNLP: boolean;
  enableDatePicker: boolean;
}
```

## Dependencies

### External
- **Luxon** (~70kb): Date manipulation and formatting
- **chrono-node** (~100kb): Natural language parsing (lazy-loaded)

### Obsidian API
- `Plugin`, `PluginSettingTab`
- `Editor`, `EditorPosition`, `EditorSelection`
- `Modal` (for DatePicker)
- `moment.locale()` (for locale detection)

## Testing Strategy

### Unit Tests
- Services (DateService, ParserService, FormatterService)
- Utilities (validators, locale detection)
- Pure function transformations

### Integration Tests
- Command → Service → Result
- Parser strategies (ISO → locale → NLP fallback)
- Format cycling

### Manual Testing
- UI interactions (DatePicker, settings)
- Keyboard shortcuts
- Cross-locale behavior

## Performance Considerations

1. **Lazy Loading**
   - chrono-node loaded only when NLP parsing needed
   - DatePicker UI rendered on-demand

2. **Caching**
   - Compiled regex patterns (Pattern Registry)
   - Locale data (I18nService)
   - Format presets

3. **Fast Paths**
   - ISO 8601 parsing first (cheapest)
   - Common formats cached in FormatterService

## Security Considerations

- Input sanitization for custom formats (prevent code injection)
- Validate regex patterns from user (no catastrophic backtracking)
- No eval() or new Function() for format strings

## Future Extensions

### Phase 6+ (Not in initial scope)
- Date range operations (duration calculations)
- Recurring date patterns ("every Monday")
- Integration with Obsidian Dataview
- Custom format templates (Handlebars-like)
- Date arithmetic via command palette

## References

- [ADR 0001: Luxon for date management](../decisions/0001_use_luxon_for_date_management.md)
- [ADR 0002: NLP parser hybrid approach](../decisions/0002_nlp_parser_hybrid_approach.md)
- [ADR 0003: Custom lightweight i18n](../decisions/0003_custom_lightweight_i18n.md)
- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
