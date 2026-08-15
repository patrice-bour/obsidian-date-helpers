import * as fs from 'fs';
import * as path from 'path';

/** Repository root, from `tests/helpers`. */
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const SRC_DIR = path.join(REPO_ROOT, 'src');

/**
 * Dotted keys of a locale file: `{ a: { b: 'x' } }` → `['a.b']`.
 * Shared by the parity, unused-key and English-value guardrails.
 */
export function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [];
}

/** Read one dotted key out of a locale object. */
export function lookupKey(source: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[part]
          : undefined,
      source
    );
}

/**
 * Every `.ts` file under `src`, minus what the caller excludes.
 *
 * The exclusion is deliberately a parameter: the unused-key scan MUST skip
 * `i18n/types.ts`, since declaring a key there is not reading it and scanning
 * the union would make every key look used.
 */
export function collectSourceFiles(
  dir: string = SRC_DIR,
  exclude: (file: string) => boolean = () => false
): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full, exclude);
    return entry.isFile() && full.endsWith('.ts') && !exclude(full) ? [full] : [];
  });
}
