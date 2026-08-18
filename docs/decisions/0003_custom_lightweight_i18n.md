# ADR 0003: Custom Lightweight i18n Approach

**Status:** Accepted
**Date:** 2025-11-02
**Deciders:** Project team

## Context

The plugin requires internationalization for:
- UI strings (command names, settings labels, error messages)
- Date/time display (handled by Luxon)
- Natural language parsing (handled by chrono-node + custom rules)

We need to decide how to handle UI string translations across multiple languages while keeping the plugin lightweight and maintainable.

## Decision Drivers

- **Bundle size**: Avoid heavy i18n frameworks for limited UI strings
- **Simplicity**: Clear translation workflow for contributors
- **Maintainability**: Easy to add new languages
- **Obsidian integration**: Align with Obsidian's locale setting
- **Developer experience**: Type-safe translation keys

## Options Considered

### Option 1: i18next (~20kb + plugins)

**Pros:**
- Industry standard
- Rich features (pluralization, interpolation, namespaces)
- TypeScript support
- Plugin ecosystem
- Familiar to many developers

**Cons:**
- ~20kb+ bundle overhead
- Over-engineered for our limited UI strings
- Additional API surface to learn
- More complex setup

### Option 2: Custom lightweight solution

**Pros:**
- Minimal bundle size (~1-2kb)
- Simple JSON dictionaries
- Full control over implementation
- Easy to understand codebase
- Type-safe with TypeScript

**Cons:**
- Need to implement ourselves
- Less features (but may not need them)
- No community plugins

### Option 3: Obsidian's i18n system

**Pros:**
- Zero bundle size (reuse existing)
- Automatic locale sync
- No custom code

**Cons:**
- Coupled to Obsidian internals
- May not be public API
- Limited to Obsidian's supported languages
- Less control over format

### Option 4: No i18n for UI (English only)

**Pros:**
- Zero complexity
- Zero bundle size

**Cons:**
- Poor user experience for non-English users
- Conflicts with core plugin principle (i18n first)

## Decision

**Chosen: Custom lightweight solution**

We will implement a simple i18n system:
- JSON dictionaries per locale (`src/i18n/locales/en.json`, `fr.json`, etc.)
- Fallback chain: User preference → Obsidian locale → English
- Type-safe translation keys using TypeScript
- Simple interpolation for dynamic values

## Implementation

### Structure
```
src/
  i18n/
    locales/
      en.json
      fr.json
      es.json
      ...
    i18n.ts (core service)
    types.ts (TypeScript definitions)
```

### Usage
```typescript
// Type-safe translation keys
t('commands.insertDate.name') // "Insert date"
t('settings.format.label')    // "Date format"
t('errors.invalidDate', { date: userInput }) // with interpolation
```

### Locale Resolution
1. Check plugin settings for manual locale override
2. Fall back to Obsidian's `moment.locale()`
3. Fall back to `en` if unsupported

### Date/Time i18n
- Delegate to Luxon (via Intl API)
- Separate concern from UI strings
- Use locale code from resolution above

## Consequences

### Positive
- Minimal bundle impact (~1-2kb)
- Simple mental model for contributors
- Full type safety with TypeScript
- Easy to add new languages (just JSON files)
- Clear separation: UI strings vs. date formatting vs. NLP parsing

### Negative
- No advanced features (pluralization, gender, etc.)
- Manual implementation required
- Need to maintain own solution

### Mitigation
- Document translation contribution process
- Provide template for new languages
- Keep feature set minimal (we don't need complex i18n)
- Can migrate to i18next later if needed

## API Design

### Translation files (JSON)
```json
{
  "commands": {
    "insertDate": {
      "name": "Insert date",
      "desc": "Insert a date at cursor position"
    }
  },
  "settings": {
    "format": {
      "label": "Date format",
      "desc": "Default format for inserted dates"
    }
  },
  "errors": {
    "invalidDate": "Invalid date: {{date}}"
  }
}
```

### TypeScript interface
```typescript
interface TranslationKeys {
  'commands.insertDate.name': never;
  'commands.insertDate.desc': never;
  'errors.invalidDate': { date: string };
}

function t<K extends keyof TranslationKeys>(
  key: K,
  ...args: TranslationKeys[K] extends never ? [] : [TranslationKeys[K]]
): string;
```

## Future Considerations

- If UI grows significantly (>50 strings), reconsider i18next
- Could lazy-load translations (fetch JSON on demand)
- Consider community translations via Crowdin/Weblate

## References

- [Obsidian i18n examples](https://github.com/obsidianmd/obsidian-releases/tree/master/plugin-review.md#internationalization)
- Similar approach: Obsidian Calendar Plugin, Natural Language Dates
