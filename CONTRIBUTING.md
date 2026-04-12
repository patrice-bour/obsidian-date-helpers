# Contributing to Date Helpers

Thank you for your interest in contributing to Date Helpers! This document provides guidelines for development and contribution.

## Prerequisites

- **Node.js**: >= 18
- **npm**: >= 9
- **Git**: For version control

## Getting Started

### Clone and Setup

```bash
git clone https://github.com/patrice-bour/obsidian-date-helpers.git
cd obsidian-date-helpers
npm install
```

### Development Workflow

```bash
# Start development mode (watch for changes)
npm run dev

# Run tests
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report

# Code quality
npm run typecheck     # TypeScript validation
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format with Prettier

# Full validation (run before commits)
npm run validate      # typecheck + lint + test

# Production build
npm run build
```

### Testing in Obsidian

1. Build the plugin: `npm run build`
2. Create a symlink to your vault:
   ```bash
   ln -s /path/to/obsidian-date-helpers /path/to/vault/.obsidian/plugins/date-helpers
   ```
3. Enable the plugin in Obsidian Settings → Community Plugins
4. Use `Cmd/Ctrl+Shift+I` to open developer console for debugging

## Project Structure

```
src/
├── main.ts              # Plugin entry point
├── types/               # TypeScript interfaces
├── services/            # Core business logic
│   ├── date-service.ts      # Date operations (Luxon)
│   ├── formatter-service.ts # Date formatting
│   ├── nlp-service.ts       # Natural language parsing
│   ├── i18n-service.ts      # Internationalization
│   └── daily-notes-service.ts # Daily Notes integration
├── ui/                  # UI components
│   ├── unified-date-picker-modal.ts
│   ├── date-picker-suggest.ts
│   └── settings-tab.ts
├── utils/               # Utility functions
└── i18n/                # Translations

tests/
├── setup.ts             # Jest configuration
├── mocks/               # Obsidian API mocks
└── unit/                # Unit tests (mirrors src/)
```

## Code Standards

### TypeScript

- **Strict mode** enabled with additional checks
- Use path aliases: `@/*` maps to `src/*`
- All functions must have explicit return types

### Testing

- **Test-Driven Development (TDD)**: Write tests first
- **Coverage requirement**: > 80%
- Tests mirror source structure in `tests/unit/`

### Code Style

- **ESLint + Prettier** enforced
- Run `npm run lint:fix` before committing
- Follow existing patterns in the codebase

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Examples**:
```
feat(nlp): add support for Dutch language
fix(picker): correct keyboard navigation in calendar
docs(readme): update installation instructions
```

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code standards

3. **Run full validation**:
   ```bash
   npm run validate
   npm run build
   ```

4. **Commit with clear messages** following conventional commits

5. **Push and create a PR**:
   ```bash
   git push -u origin feature/your-feature-name
   ```

6. **PR Description** should include:
   - What changes were made and why
   - How to test the changes
   - Any breaking changes

## Documentation

- **User Guide**: [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md) — end-user workflows and configuration
- **Architecture**: [`docs/arch/0001_architecture_overview.md`](./docs/arch/0001_architecture_overview.md) — system design for contributors

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Reporting Security Issues

Please do **not** open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md) for the private reporting process.

## Questions?

- **Issues**: [GitHub Issues](https://github.com/patrice-bour/obsidian-date-helpers/issues)
- **Discussions**: [GitHub Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions)
