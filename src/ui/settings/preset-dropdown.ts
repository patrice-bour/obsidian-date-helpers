import { FormatterService } from '@/services/formatter-service';
import { FormatPreset } from '@/types/format-preset';
import { Translate } from '@/i18n/types';
import { presetName } from '@/i18n/preset-labels';

export interface PresetOptionsInput {
  presets: FormatPreset[];
  formatterService: FormatterService;
  /** Translate a key with the plugin's i18n service */
  t: Translate;
  /** When true, an "original-text" option is added first */
  withOriginalText?: boolean;
}

/** Placeholder key used when the preset list is empty. */
const NO_PRESETS_OPTION = 'none';

/**
 * Build the option map of a preset dropdown: "Name (example)" per preset, an
 * optional "Original Text" first entry, and a lone placeholder when there is
 * nothing to choose from (the caller disables the control in that case).
 */
export function buildPresetOptions(input: PresetOptionsInput): Record<string, string> {
  if (input.presets.length === 0) {
    return { [NO_PRESETS_OPTION]: input.t('settings.text.noPresetsAvailable') };
  }

  const options: Record<string, string> = {};
  if (input.withOriginalText) {
    options['original-text'] = input.t('picker.originalText');
  }

  input.presets.forEach(preset => {
    const example = input.formatterService.getFormatExample(preset.format);
    options[preset.id] = `${presetName(preset, input.t)} (${example})`;
  });

  return options;
}
