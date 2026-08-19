# ADR 0001: Use Luxon for Date Management

**Status:** Accepted
**Date:** 2025-11-02
**Deciders:** Project team

## Context

The plugin requires robust date manipulation capabilities with strong internationalization support. The chosen library must handle:

- Date parsing and formatting across multiple locales
- Timezone management
- Immutable date operations (to prevent bugs)
- Calendar calculations (week numbers, relative dates, etc.)
- Reasonable bundle size for an Obsidian plugin

## Decision Drivers

- **i18n first-class support**: Plugin core requirement
- **Immutability**: Reduces bugs in date calculations
- **API ergonomics**: Developer experience and maintainability
- **Bundle size**: Impact on plugin load time
- **Active maintenance**: Long-term viability

## Options Considered

### Option 1: Luxon (~70kb)

**Pros:**
- Built-in i18n using Intl API
- Immutable by design
- Excellent timezone support
- Modern API inspired by Joda-Time
- Good documentation
- Active maintenance

**Cons:**
- Larger bundle size
- Learning curve for team unfamiliar with it

### Option 2: Day.js (~2kb core, ~15kb with i18n plugins)

**Pros:**
- Very lightweight core
- Moment.js-compatible API (familiar)
- Plugin architecture

**Cons:**
- i18n requires separate plugins
- Mutable by default (needs immutable plugin)
- Less comprehensive locale data

### Option 3: date-fns (~13kb with i18n)

**Pros:**
- Functional approach
- Tree-shakable
- Good performance

**Cons:**
- Verbose API (many imports)
- i18n less integrated
- No timezone support in core

### Option 4: Temporal API (polyfill ~50kb)

**Pros:**
- Future standard
- Excellent i18n
- Immutable

**Cons:**
- Still Stage 3 proposal
- Polyfill required (large)
- Browser support incomplete
- API may change

## Decision

**Chosen: Luxon**

Luxon provides the best balance of features for our use case:
- Native i18n support aligns with our core requirement
- Immutability prevents common date manipulation bugs
- Comprehensive API reduces need for utility functions
- 70kb is acceptable for the features gained

## Consequences

### Positive
- Robust locale handling out of the box
- Less custom code for date operations
- Immutability improves code reliability
- Good TypeScript support

### Negative
- ~70kb added to bundle size
- Team needs to learn Luxon API
- Some duplication with Obsidian's moment.js (if used internally)

### Mitigation
- Use tree-shaking where possible
- Document common patterns in codebase
- Create utility wrappers for frequently used operations

## References

- [Luxon documentation](https://moment.github.io/luxon/)
- [Temporal API proposal](https://tc39.es/proposal-temporal/)
- Bundle size comparison: [Bundlephobia](https://bundlephobia.com/)
