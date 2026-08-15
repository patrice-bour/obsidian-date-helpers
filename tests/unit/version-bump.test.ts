import { execFileSync } from 'child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const SCRIPT = resolve(__dirname, '../../scripts/version-bump.mjs');

const MANIFEST = `{
  "id": "date-helpers",
  "name": "Date Helpers",
  "version": "0.1.3",
  "minAppVersion": "1.13.0",
  "isDesktopOnly": false
}
`;

// 0.1.3 is deliberately mapped to an *older* floor than the manifest declares:
// re-cutting a version after minAppVersion was raised is the case where
// overwriting and preserving stop producing the same file.
const README = `# Date Helpers

[![CI](https://example.test/ci.svg)](https://example.test/ci)
[![Version](https://img.shields.io/badge/version-0.1.3-blue.svg)](./CHANGELOG.md)

Body text mentioning 0.1.3 in prose, which is not the badge.
`;

const VERSIONS = `{
  "0.1.2": "1.5.0",
  "0.1.3": "1.5.0"
}
`;

/**
 * Runs the release hook the way `npm version` does: from the package root, with
 * the already-bumped version handed over through the environment.
 */
function runBump(
  cwd: string,
  version: string | undefined
): { status: number; stderr: string; stdout: string } {
  const env = { ...process.env };
  delete env.npm_package_version;
  if (version !== undefined) {
    env.npm_package_version = version;
  }

  try {
    const stdout = execFileSync('node', [SCRIPT], { cwd, env, encoding: 'utf8' });
    return { status: 0, stderr: '', stdout };
  } catch (error) {
    const failure = error as { status: number; stderr: string; stdout: string };
    return { status: failure.status, stderr: failure.stderr, stdout: failure.stdout };
  }
}

describe('version-bump hook', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'version-bump-'));
    writeFileSync(join(dir, 'manifest.json'), MANIFEST);
    writeFileSync(join(dir, 'versions.json'), VERSIONS);
    writeFileSync(join(dir, 'README.md'), README);
  });

  afterEach(() => {
    // One test drops the write bit; restore it so the cleanup can proceed.
    for (const name of ['versions.json', 'README.md']) {
      if (existsSync(join(dir, name))) {
        chmodSync(join(dir, name), 0o644);
      }
    }
    rmSync(dir, { recursive: true, force: true });
  });

  const readJson = (name: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>;

  it('propagates the new version to the manifest', () => {
    expect(runBump(dir, '0.1.4').status).toBe(0);

    expect(readJson('manifest.json').version).toBe('0.1.4');
  });

  it('maps the new version to the manifest minAppVersion in versions.json', () => {
    runBump(dir, '0.1.4');

    expect(readJson('versions.json')).toEqual({
      '0.1.2': '1.5.0',
      '0.1.3': '1.5.0',
      '0.1.4': '1.13.0',
    });
  });

  it('leaves every other manifest field untouched', () => {
    runBump(dir, '0.1.4');

    const manifest = readJson('manifest.json');
    expect(manifest.id).toBe('date-helpers');
    expect(manifest.name).toBe('Date Helpers');
    expect(manifest.minAppVersion).toBe('1.13.0');
    expect(manifest.isDesktopOnly).toBe(false);
  });

  it('keeps the two-space indentation and the trailing newline the repository uses', () => {
    runBump(dir, '0.1.4');

    const manifest = readFileSync(join(dir, 'manifest.json'), 'utf8');
    const versions = readFileSync(join(dir, 'versions.json'), 'utf8');

    expect(manifest).toContain('\n  "id": "date-helpers"');
    expect(manifest).not.toContain('\t');
    expect(manifest.endsWith('}\n')).toBe(true);
    expect(versions).toContain('\n  "0.1.4": "1.13.0"');
    expect(versions.endsWith('}\n')).toBe(true);
  });

  it('re-cutting a version realigns its floor on the current minAppVersion', () => {
    runBump(dir, '0.1.3');

    expect(readJson('versions.json')).toEqual({
      '0.1.2': '1.5.0',
      '0.1.3': '1.13.0',
    });
  });

  it('fails loudly when npm did not provide a version', () => {
    const { status, stderr } = runBump(dir, undefined);

    expect(status).not.toBe(0);
    expect(stderr).toContain('npm_package_version');
    expect(readJson('manifest.json').version).toBe('0.1.3');
    expect(readJson('versions.json')).not.toHaveProperty('undefined');
  });

  it('fails without writing anything when the manifest has no minAppVersion', () => {
    writeFileSync(join(dir, 'manifest.json'), '{\n  "version": "0.1.3"\n}\n');

    const { status, stderr } = runBump(dir, '0.1.4');

    expect(status).not.toBe(0);
    expect(stderr).toContain('minAppVersion');
    expect(readJson('versions.json')).not.toHaveProperty('0.1.4');
  });

  it.each(['manifest.json', 'versions.json'])(
    'fails without writing anything when %s is malformed',
    file => {
      writeFileSync(join(dir, file), '{ not json');

      const { status, stderr } = runBump(dir, '0.1.4');

      expect(status).not.toBe(0);
      expect(stderr).toContain(file);
      const untouched = file === 'manifest.json' ? 'versions.json' : 'manifest.json';
      expect(readFileSync(join(dir, untouched), 'utf8')).toBe(
        untouched === 'manifest.json' ? MANIFEST : VERSIONS
      );
    }
  );

  it.each(['manifest.json', 'versions.json'])('fails when %s is missing', file => {
    rmSync(join(dir, file));

    const { status, stderr } = runBump(dir, '0.1.4');

    expect(status).not.toBe(0);
    expect(stderr).toContain(file);
  });

  // An array or a null parses fine, then swallows the assignment: without a
  // shape check the script would report success while dropping the entry it
  // exists to write.
  it.each([
    ['an array', '[]'],
    ['null', 'null'],
    ['a string', '"1.13.0"'],
  ])('fails when versions.json is %s instead of an object', (_label, content) => {
    writeFileSync(join(dir, 'versions.json'), `${content}\n`);

    const { status, stderr } = runBump(dir, '0.1.4');

    expect(status).not.toBe(0);
    expect(stderr).toContain('versions.json');
    expect(stderr).not.toContain('at Object');
    expect(readJson('manifest.json').version).toBe('0.1.3');
  });

  it('fails when manifest.json is not an object', () => {
    writeFileSync(join(dir, 'manifest.json'), '[]\n');

    const { status, stderr } = runBump(dir, '0.1.4');

    expect(status).not.toBe(0);
    expect(stderr).toContain('manifest.json');
  });

  it('bumps the README version badge', () => {
    runBump(dir, '0.1.4');

    const readme = readFileSync(join(dir, 'README.md'), 'utf8');
    expect(readme).toContain('badge/version-0.1.4-blue.svg');
    expect(readme).not.toContain('0.1.3-blue');
  });

  // The badge is the only version the script owns in the README: prose that
  // happens to name a version is the author's, not a field to rewrite.
  it('leaves the rest of the README alone', () => {
    runBump(dir, '0.1.4');

    const readme = readFileSync(join(dir, 'README.md'), 'utf8');
    expect(readme).toContain('Body text mentioning 0.1.3 in prose');
    expect(readme).toContain('[![CI](https://example.test/ci.svg)]');
    expect(readme.startsWith('# Date Helpers\n')).toBe(true);
  });

  it.each([
    ['there is no README', null],
    ['the README carries no version badge', '# Date Helpers\n\nNo badges here.\n'],
  ])('still succeeds and says so when %s', (_label, content) => {
    if (content === null) {
      rmSync(join(dir, 'README.md'));
    } else {
      writeFileSync(join(dir, 'README.md'), content);
    }

    const { status, stdout } = runBump(dir, '0.1.4');

    expect(status).toBe(0);
    expect(stdout).toContain('README');
    expect(readJson('manifest.json').version).toBe('0.1.4');
    if (content !== null) {
      expect(readFileSync(join(dir, 'README.md'), 'utf8')).toBe(content);
    }
  });

  it('restores the manifest and versions.json when the README cannot be written', () => {
    chmodSync(join(dir, 'README.md'), 0o444);

    const { status, stderr } = runBump(dir, '0.1.4');

    expect(status).not.toBe(0);
    expect(stderr).toContain('README.md');
    expect(readFileSync(join(dir, 'manifest.json'), 'utf8')).toBe(MANIFEST);
    expect(readFileSync(join(dir, 'versions.json'), 'utf8')).toBe(VERSIONS);
  });

  // versions.json is written second: the manifest is already on disk when this
  // fails. Read-only is the only way to let the read succeed and the write
  // fail — and root ignores the permission bit, so skip there rather than
  // assert something that cannot happen.
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  (isRoot ? it.skip : it)('restores the manifest when versions.json cannot be written', () => {
    chmodSync(join(dir, 'versions.json'), 0o444);

    const { status, stderr } = runBump(dir, '0.1.4');

    expect(status).not.toBe(0);
    expect(stderr).toContain('versions.json');
    expect(readFileSync(join(dir, 'manifest.json'), 'utf8')).toBe(MANIFEST);
  });
});
