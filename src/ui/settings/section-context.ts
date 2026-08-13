import DateHelpersPlugin from '@/main';
import { TranslationKey } from '@/i18n/types';

/**
 * Shared context handed to every settings section builder.
 */
export interface SettingsSectionContext {
  plugin: DateHelpersPlugin;
  /** Translate a key with the plugin's i18n service */
  t: (key: TranslationKey) => string;
  /** Re-render the whole settings tab */
  refresh: () => void;
}
