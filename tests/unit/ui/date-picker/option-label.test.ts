import { shortenOutputLabel } from '@/ui/date-picker/option-label';

describe('shortenOutputLabel', () => {
  it('leaves a plain text output alone', () => {
    expect(shortenOutputLabel('2026-08-24')).toBe('2026-08-24');
    expect(shortenOutputLabel('Monday, 24 August 2026')).toBe('Monday, 24 August 2026');
  });

  it('leaves a wikilink whose alias is short enough alone', () => {
    expect(shortenOutputLabel('[[Journal/2026-08-24|24 August 2026]]')).toBe(
      '[[Journal/2026-08-24|24 August 2026]]'
    );
  });

  it('keeps the brackets and the path, and shortens the alias alone', () => {
    expect(shortenOutputLabel('[[Journal/2026-08-24|réunion de cadrage et de lancement]]')).toBe(
      '[[Journal/2026-08-24|réunion de cadrage…]]'
    );
  });

  it('cuts on a word boundary without walking back', () => {
    expect(shortenOutputLabel('[[Journal/2026-08-24|point hebdomadaire équipe]]')).toBe(
      '[[Journal/2026-08-24|point hebdomadaire…]]'
    );
  });

  it('walks back to the last space rather than cutting a word', () => {
    expect(shortenOutputLabel('[[Journal/2026-08-24|réunion de lancement produit]]')).toBe(
      '[[Journal/2026-08-24|réunion de…]]'
    );
  });

  it('walks back to a comma, and leaves no dangling one', () => {
    expect(shortenOutputLabel('[[Journal/2026-08-24|lundi, vingt-quatre août]]')).toBe(
      '[[Journal/2026-08-24|lundi…]]'
    );
  });

  it('cuts a single long word where it stands', () => {
    expect(shortenOutputLabel('[[Journal/2026-08-24|anticonstitutionnellement]]')).toBe(
      '[[Journal/2026-08-24|anticonstitutionne…]]'
    );
  });

  it('never cuts a character in half', () => {
    // L'emoji tombe pile sur la limite : découper en unités UTF-16 laisserait
    // un demi-caractère, rendu « � » dans le menu déroulant.
    const label = shortenOutputLabel('[[J/2026-08-24|aaaaaaaaaaaaaaaaa👍 suite]]');

    expect(label).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(label).toBe('[[J/2026-08-24|aaaaaaaaaaaaaaaaa👍…]]');
  });

  it('counts an emoji as one character, not two', () => {
    // 18 emoji, donc 18 caractères : rien à raccourcir.
    const alias = '👍'.repeat(18);
    expect(shortenOutputLabel(`[[J/2026-08-24|${alias}]]`)).toBe(`[[J/2026-08-24|${alias}]]`);
  });

  it('shortens the alias, never the path', () => {
    const long = '[[a/very/long/journal/path/2026-08-24|réunion de cadrage et de lancement]]';
    expect(shortenOutputLabel(long)).toBe(
      '[[a/very/long/journal/path/2026-08-24|réunion de cadrage…]]'
    );
  });

  it('leaves the open-daily-note line alone, wikilink or not', () => {
    expect(shortenOutputLabel('Open: Journal/2026-08-24.md')).toBe('Open: Journal/2026-08-24.md');
  });
});
