import { FormatterService } from '@/services/formatter-service';
import { FormatPreset } from '@/types/format-preset';

export interface PresetOptionsInput {
  presets: FormatPreset[];
  formatterService: FormatterService;
  /** Label for the placeholder shown when no preset of this type exists */
  noPresetsLabel: string;
  /** When set, an "original-text" option is added first with this label */
  originalTextLabel?: string;
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
    return { [NO_PRESETS_OPTION]: input.noPresetsLabel };
  }

  const options: Record<string, string> = {};
  if (input.originalTextLabel !== undefined) {
    options['original-text'] = input.originalTextLabel;
  }

  input.presets.forEach(preset => {
    const example = input.formatterService.getFormatExample(preset.format);
    options[preset.id] = `${preset.name} (${example})`;
  });

  return options;
}

