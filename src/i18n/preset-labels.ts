import { FormatPreset } from '@/types/format-preset';
import { PlainTranslationKey, Translate } from '@/i18n/types';

/**
 * Resolve a preset's label from its identity.
 *
 * Built-in presets are stored without a name or description — both come from
 * `settings.presets.formats.<id>.*`, so a preset reads in the user's language
 * wherever it appears: settings list, picker format selector, command names.
 * User-defined presets keep their own words, which are never translated.
 *
 * A missing key comes back as the key itself (`I18nService.t`), which is the
 * signal to fall back — that is what makes a user-defined id work here too.
 */
export function presetName(preset: FormatPreset, t: Translate): string {
  return translated(t, `settings.presets.formats.${preset.id}.name`) ?? preset.name ?? preset.id;
}

export function presetDescription(preset: FormatPreset, t: Translate): string {
  return (
    translated(t, `settings.presets.formats.${preset.id}.desc`) ??
    preset.description ??
    preset.format
  );
}

function translated(t: Translate, key: string): string | null {
  // `PlainTranslationKey`, not `TranslationKey`: the wide union would let a
  // parameterised key through with no argument, and render its raw template.
  const value = t(key as PlainTranslationKey);
  return value === key ? null : value;
}
