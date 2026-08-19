import { FormatterService } from '@/services/formatter-service';
import { FormatPreset } from '@/types/format-preset';
import { Translate } from '@/i18n/types';
import { presetName } from '@/i18n/preset-labels';
import { SELECTED_TEXT_SOURCE, TYPED_TEXT_SOURCE } from '@/types/alias-source';

export interface PresetOptionsInput {
  presets: FormatPreset[];
  formatterService: FormatterService;
  /** Translate a key with the plugin's i18n service */
  t: Translate;
  /** When true, the text alias sources are added first */
  withAliasSources?: boolean;
}

/** Placeholder key used when the preset list is empty. */
const NO_PRESETS_OPTION = 'none';

/**
 * Build the option map of a preset dropdown: "Name (example)" per preset, the
 * optional text alias sources as first entries, and a lone placeholder when
 * there is nothing to choose from (the caller disables the control in that
 * case).
 */
export function buildPresetOptions(input: PresetOptionsInput): Record<string, string> {
  if (input.presets.length === 0) {
    return { [NO_PRESETS_OPTION]: input.t('settings.text.noPresetsAvailable') };
  }

  const options: Record<string, string> = {};
  if (input.withAliasSources) {
    options[SELECTED_TEXT_SOURCE] = input.t('picker.selectedText');
    options[TYPED_TEXT_SOURCE] = input.t('picker.typedText');
  }

  input.presets.forEach(preset => {
    const example = input.formatterService.getFormatExample(preset.format);
    options[preset.id] = `${presetName(preset, input.t)} (${example})`;
  });

  return options;
}
