import { scanUserFacingLiterals, ALLOWLIST } from '../../helpers/user-facing-strings';

/**
 * Guardrail for the `locale-i18n` requirement "no user-facing literal may
 * remain in the source". Unit tests assert what the code declares; only a
 * structural test catches what it forgot to declare at all.
 */
describe('no hardcoded user-facing strings', () => {
  it('routes every user-facing string through the i18n service', () => {
    const violations = scanUserFacingLiterals();

    const report = violations
      .map(v => `  ${v.file}:${v.line} [${v.kind}] ${JSON.stringify(v.text)}`)
      .join('\n');

    expect(report).toBe('');
  });

  it('states a reason for every allowlisted literal', () => {
    ALLOWLIST.forEach(entry => {
      expect(entry.reason.length).toBeGreaterThan(0);
    });
  });
});
