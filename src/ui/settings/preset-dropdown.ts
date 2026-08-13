import { Setting } from 'obsidian';
import { FormatterService } from '@/services/formatter-service';
import { FormatPreset } from '@/types/format-preset';

export interface PresetDropdownOptions {
  presets: FormatPreset[];
  formatterService: FormatterService;
  /** Currently selected value */
  value: string;
  /** Label for the disabled placeholder when no presets exist */
  noPresetsLabel: string;
  /** When set, an "original-text" option is added first with this label */
  originalTextLabel?: string;
  onChange(value: string): void | Promise<void>;
}

/**
 * Add a preset dropdown to a Setting: "Name (example)" per preset, a
 * disabled placeholder when the preset list is empty, and an optional
 * "Original Text" first option. Collapses the five duplicated dropdown
 * blocks of the settings tab.
 */
export function addPresetDropdown(setting: Setting, opts: PresetDropdownOptions): Setting {
  return setting.addDropdown(dropdown => {
    if (opts.presets.length === 0) {
      dropdown.addOption('none', opts.noPresetsLabel);
      dropdown.setDisabled(true);
      return;
    }

    if (opts.originalTextLabel !== undefined) {
      dropdown.addOption('original-text', opts.originalTextLabel);
    }

    opts.presets.forEach(preset => {
      const example = opts.formatterService.getFormatExample(preset.format);
      dropdown.addOption(preset.id, `${preset.name} (${example})`);
    });

    dropdown.setValue(opts.value);
    dropdown.onChange(value => void opts.onChange(value));
  });
}
