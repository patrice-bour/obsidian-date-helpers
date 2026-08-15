/**
 * Release hook for `npm version`.
 *
 * npm bumps package.json and the lockfile on its own, then runs this from the
 * package root with the new version in npm_package_version. What it does not
 * touch is what Obsidian actually reads: manifest.json, and versions.json,
 * which is what the community store uses to decide which release a given
 * Obsidian version is served — plus the README version badge, which drifted
 * behind three releases in a row while it was maintained by hand.
 *
 * Everything is read, checked and serialized before the first byte is written,
 * and any file already written is put back if a later write fails: a
 * half-bumped tree is the one state that would go unnoticed until the store
 * serves a version whose floor was never recorded.
 */
import { readFileSync, writeFileSync } from 'fs';

const fail = (message) => {
  process.stderr.write(`version-bump: ${message}\n`);
  process.exit(1);
};

const say = (message) => {
  process.stdout.write(`version-bump: ${message}\n`);
};

const readObject = (path) => {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    return fail(`could not read ${path}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return fail(`could not parse ${path}: ${error.message}`);
  }

  // A JSON array or null parses fine and then swallows every assignment
  // silently, which would let this script report success while dropping the
  // entry it exists to write.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail(`${path} must contain a JSON object`);
  }

  return { raw, parsed };
};

// Written back with the repository's own formatting — two spaces and a
// trailing newline — so a release does not reformat the file it bumps.
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
  fail('npm_package_version is not set — this runs as an npm lifecycle script');
}

const manifest = readObject('manifest.json');
const { minAppVersion } = manifest.parsed;
if (!minAppVersion) {
  fail('manifest.json has no minAppVersion, so versions.json cannot be mapped');
}

const versions = readObject('versions.json');

manifest.parsed.version = targetVersion;
versions.parsed[targetVersion] = minAppVersion;

const writes = [
  { path: 'manifest.json', next: serialize(manifest.parsed), previous: manifest.raw },
  { path: 'versions.json', next: serialize(versions.parsed), previous: versions.raw }
];

// The badge is the only version the README owns: prose that happens to name a
// version belongs to the author. Its absence is not an error — the private
// repository carries no badge, and this script ships to both.
const BADGE = /badge\/version-\d+\.\d+\.\d+-/g;
let readme;
try {
  readme = readFileSync('README.md', 'utf8');
} catch {
  say('no README.md — badge skipped');
}

if (readme !== undefined) {
  // Compared rather than tested: a /g regex carries lastIndex between calls,
  // and the rewrite is the only question worth asking anyway.
  const next = readme.replace(BADGE, `badge/version-${targetVersion}-`);
  if (next === readme) {
    say('no version badge in README.md — skipped');
  } else {
    writes.push({ path: 'README.md', next, previous: readme });
  }
}

const written = [];
for (const { path, next, previous } of writes) {
  try {
    writeFileSync(path, next);
    written.push({ path, previous });
  } catch (error) {
    const undone = [];
    for (const done of written.reverse()) {
      try {
        writeFileSync(done.path, done.previous);
      } catch {
        undone.push(done.path);
      }
    }
    if (undone.length > 0) {
      fail(
        `could not write ${path}: ${error.message} — and ${undone.join(', ')} could not be restored, fix by hand`
      );
    }
    fail(`could not write ${path}: ${error.message} — earlier files restored`);
  }
}

say(`manifest ${targetVersion}, versions.json → ${minAppVersion}`);
