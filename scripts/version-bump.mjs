/**
 * Release hook for `npm version`.
 *
 * npm bumps package.json and the lockfile on its own, then runs this from the
 * package root with the new version in npm_package_version. What it does not
 * touch is what Obsidian actually reads: manifest.json, and versions.json,
 * which is what the community store uses to decide which release a given
 * Obsidian version is served.
 *
 * Both files are read, checked and serialized before the first byte is
 * written, and the manifest is put back if writing versions.json fails — a
 * half-bumped tree is the one state that would go unnoticed until the store
 * serves a version whose floor was never recorded.
 */
import { readFileSync, writeFileSync } from 'fs';

const fail = (message) => {
  process.stderr.write(`version-bump: ${message}\n`);
  process.exit(1);
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

const nextManifest = serialize(manifest.parsed);
const nextVersions = serialize(versions.parsed);

try {
  writeFileSync('manifest.json', nextManifest);
} catch (error) {
  fail(`could not write manifest.json: ${error.message}`);
}

try {
  writeFileSync('versions.json', nextVersions);
} catch (error) {
  try {
    writeFileSync('manifest.json', manifest.raw);
  } catch {
    fail(
      `could not write versions.json: ${error.message} — and manifest.json is left at ${targetVersion}, restore it by hand`
    );
  }
  fail(`could not write versions.json: ${error.message} — manifest.json restored`);
}

process.stdout.write(
  `version-bump: manifest ${targetVersion}, versions.json → ${minAppVersion}\n`
);
