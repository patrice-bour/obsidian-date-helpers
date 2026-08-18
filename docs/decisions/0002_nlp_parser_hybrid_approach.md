# ADR 0002: NLP Parser Hybrid Approach

**Status:** Accepted
**Date:** 2025-11-02
**Deciders:** Project team

## Context

The plugin needs to parse natural language date expressions in multiple languages:
- Relative expressions: "today", "tomorrow", "3 days ago"
- Weekday references: "next Monday", "first Friday of next month"
- Localized formats: "3 mai 2024", "14h30", "2:30 pm"
- Date ranges: "from May 3 to May 5"

The solution must be:
- Extensible for new languages and patterns
- Maintainable by the team
- Performant for real-time parsing as user types
- Accurate across different locales

## Decision Drivers

- **Multi-language support**: Core requirement
- **Extensibility**: Easy to add new patterns
- **Maintenance burden**: Balance between custom code and dependencies
- **Performance**: Real-time parsing feedback
- **Accuracy**: Minimize false positives/negatives

## Options Considered

### Option 1: chrono-node (pure)

**Pros:**
- Mature library (~100kb)
- Multi-language support built-in (en, fr, de, ja, pt, nl)
- Battle-tested in production
- Active maintenance

**Cons:**
- ~100kb bundle size
- Some patterns may not match our specific needs
- Black box for custom extensions
- May parse too aggressively (false positives)

### Option 2: Custom parser from scratch

**Pros:**
- Full control over behavior
- Minimal bundle size
- Tailored to our exact needs
- Educational value

**Cons:**
- Significant development effort
- Need to handle edge cases ourselves
- Maintenance burden
- Likely less comprehensive than mature library

### Option 3: Hybrid approach (chrono-node + custom extensions)

**Pros:**
- Leverage mature library for common cases
- Custom refiners for specific patterns
- Extensible architecture
- Can disable chrono for specific contexts if needed

**Cons:**
- Complexity of two systems
- Still includes chrono-node bundle size
- Need to learn chrono's refiner API

### Option 4: Lightweight regex-based parser

**Pros:**
- Very small bundle
- Fast execution
- Easy to understand

**Cons:**
- Limited to simple patterns
- Difficult to handle complex cases (relative dates, weekdays)
- Poor internationalization support
- Fragile with edge cases

## Decision

**Chosen: Hybrid approach (chrono-node + custom extensions)**

We will use chrono-node as the foundation and extend it with custom refiners for:
- Plugin-specific date formats
- Additional locale support
- Context-aware parsing (e.g., within selection vs. trigger characters)
- Integration with Luxon for final date objects

## Implementation Strategy

### Phase 3 (Basic NLP)
- Use chrono-node for English and French
- Simple custom patterns for common relative dates
- Fallback to ISO 8601 parsing

### Phase 4 (Advanced NLP)
- Custom refiners for complex patterns
- Language pack architecture (JSON configs)
- Extensibility API for user-defined patterns

### Architecture
```
User input → Custom pre-processor → chrono-node → Custom refiners → Luxon DateTime
                                         ↓
                                   Language packs (JSON)
```

## Consequences

### Positive
- Rapid development for Phase 3 (leverage chrono-node)
- Professional-grade parsing from day one
- Clear extension path for advanced features
- Can optimize/replace parts incrementally

### Negative
- ~100kb bundle addition
- Need to understand chrono's refiner system
- Potential conflicts between chrono and custom rules
- Testing complexity (two systems to validate)

### Mitigation
- Document common refiner patterns
- Create test suite covering both systems
- Consider lazy-loading chrono for advanced NLP features
- Monitor bundle size; evaluate custom parser if >150kb total

## References

- [chrono-node GitHub](https://github.com/wanasit/chrono)
- [chrono custom refiners guide](https://github.com/wanasit/chrono#customize-chrono)
- Similar approach used by: Notion, Todoist, TickTick

## Future Considerations

If bundle size becomes an issue:
- Implement progressive enhancement (basic → advanced parsing)
- Lazy-load chrono-node only when advanced NLP commands used
- Evaluate minimal regex parser for Phase 3 only
