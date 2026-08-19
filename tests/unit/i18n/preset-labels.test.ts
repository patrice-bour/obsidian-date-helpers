import { I18nService } from '@/services/i18n-service';
import { presetDescription, presetName } from '@/i18n/preset-labels';
import { DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { FormatPreset } from '@/types/format-preset';
import { translateWith } from '../../helpers/translate';

const userPreset: FormatPreset = {
  id: 'my-format',
  name: 'Mon format',
  description: 'Le format que je préfère',
  format: 'dd/MM',
  type: 'date',
  builtin: false,
};

describe('preset labels', () => {
  describe('built-in presets', () => {
    const en = new I18nService('en');
    const fr = new I18nService('fr');

    it.each(DEFAULT_FORMAT_PRESETS.map(preset => [preset.id, preset] as const))(
      '%s is labelled from the locale files, never from the key itself',
      (id, preset) => {
        [en, fr].forEach(service => {
          const name = presetName(preset, translateWith(service));
          const desc = presetDescription(preset, translateWith(service));

          // A missing key comes back as the key, and a missing translation
          // would silently fall through to the format pattern
          expect(name).not.toContain(id);
          expect(desc).not.toBe(preset.format);
          expect(name.length).toBeGreaterThan(0);
          expect(desc.length).toBeGreaterThan(0);
        });
      }
    );

    it('resolves the name from the id, not from stored data', () => {
      const iso = DEFAULT_FORMAT_PRESETS.find(preset => preset.id === 'iso8601')!;
      expect(presetName(iso, translateWith(fr))).toBe('ISO 8601');
      expect(presetDescription(iso, translateWith(fr))).toBe('Format ISO standard');
    });

    it('ignores a name left over in stored data by an earlier version', () => {
      const stale = { ...DEFAULT_FORMAT_PRESETS[0], name: 'Stale name', description: 'Stale text' };
      expect(presetName(stale, translateWith(fr))).toBe('ISO 8601');
      expect(presetDescription(stale, translateWith(fr))).toBe('Format ISO standard');
    });

    it('reads the French label of a preset whose English label is different', () => {
      const short = DEFAULT_FORMAT_PRESETS.find(preset => preset.id === 'locale-short')!;
      expect(presetName(short, translateWith(en))).toBe('Locale short');
      expect(presetName(short, translateWith(fr))).toBe('Date courte');
    });
  });

  describe('user-defined presets', () => {
    const fr = new I18nService('fr');
    const t = translateWith(fr);

    it('keeps the user words in any locale', () => {
      expect(presetName(userPreset, t)).toBe('Mon format');
      expect(presetDescription(userPreset, t)).toBe('Le format que je préfère');
    });

    it('falls back to the format pattern when there is no description', () => {
      expect(presetDescription({ ...userPreset, description: undefined }, t)).toBe('dd/MM');
    });

    it('falls back to the id when there is no name', () => {
      expect(presetName({ ...userPreset, name: undefined }, t)).toBe('my-format');
    });
  });
});
