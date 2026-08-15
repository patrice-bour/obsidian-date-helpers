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

## Local pre-scan against Community Portal rules

The Obsidian Community Portal re-scans every release, and `npm run lint` is configured to report what that scan reports. No extra command, no config edit: **if the portal can flag it, `npm run lint` flags it too.**

Two pieces make that true, and both must stay in place:

- [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin) is installed and wired into `eslint.config.mjs` via `obsidianmd.configs.recommended`. It supplies the popout-window, DOM-helper and settings-API rules.
- The `@typescript-eslint/no-unsafe-*` family is left at its `recommendedTypeChecked` default. **Do not disable it.** It used to be switched off, which is exactly how v0.1.0 shipped 16 portal findings that the local pipeline never reported.

Two gotchas worth knowing:

- **The portal's advice changes over time.** `activeWindow.setTimeout()` was the recommended form when v0.1.0 was scanned; the plugin now forbids it in favour of `window.setTimeout()`. Trust the current linter over any older finding — including older sections of this file.
- **Warnings do not fail the build.** `eslint src` exits 0 with warnings, so a clean exit code is not a clean scan. Read the output.

## Release tag names

The tag **is** the download path. Obsidian installs a plugin from
`https://github.com/<repo>/releases/download/<version>/<file>`, where `<version>` comes
verbatim from the repository's `manifest.json`, or from `versions.json` when the manifest's
`minAppVersion` is above the running app. A `v` prefix therefore makes every asset a 404 for
the client, however healthy the release looks on GitHub — which is what happened to v0.1.1,
v0.1.2 and v0.1.3, republished afterwards under bare-version tags.

`.npmrc` sets `tag-version-prefix=` so `npm version` produces `0.1.4`, not `v0.1.4`. The
release workflow accepts both forms, since the prefixed tags are already published. Never
change one without the other: dropping the prefix while the workflow only listens for `v*`
means no release is built at all.

## Release verification

Release assets are attested automatically by `.github/workflows/release.yml` (`actions/attest-build-provenance`). To verify after publishing:

```bash
gh release view <tag> -R <owner>/<repo> --json assets -q '.assets[] | "\(.name)  \(.digest)"'
gh api /repos/<owner>/<repo>/attestations/sha256:<digest>
```

Check each asset individually. An unchanged file keeps its digest across releases, so it can inherit an attestation issued for a *different* release and look covered when the release it belongs to was never attested at all. That is what made the v0.1.0 scorecard diagnosis subtle: `styles.css` was attested, `main.js` and `manifest.json` were not.

After publishing, check the Community Portal scorecard. The portal re-runs its review scan **only on release publication** — there is no on-demand re-scan, so a finding fixed but never re-released stays visible indefinitely.

## Unblocking a transient `npm audit` advisory

The CI and release workflows run `npm audit --audit-level=moderate`. If a freshly-published advisory blocks a merge or release, the supported escape hatches are: `npm audit fix` (when a non-breaking patch exists), bumping the offending parent dep manually, or — strictly as a temporary measure — running with `--omit=dev` if the advisory only affects dev tooling. Document any exception in the PR or release notes.

## Questions?

- **Issues**: [GitHub Issues](https://github.com/patrice-bour/obsidian-date-helpers/issues)
- **Discussions**: [GitHub Discussions](https://github.com/patrice-bour/obsidian-date-helpers/discussions)
