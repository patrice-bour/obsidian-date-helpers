import type { SettingDefinitionGroup } from 'obsidian';
import { SettingsKey, SettingsSectionContext } from '../section-context';

/**
 * Feature toggles section: date picker, NLP, and (when NLP is on)
 * auto-detect / strict mode / parsing warning sub-settings.
 *
 * The sub-settings declare a `visible` predicate rather than being omitted from
 * the tree: Obsidian re-evaluates it on `refreshDomState()`, so toggling NLP
 * shows or hides them in place, without rebuilding the tab and stealing focus
 * from the toggle the user just clicked.
 */
export function buildFeaturesSection(ctx: SettingsSectionContext): SettingDefinitionGroup<SettingsKey> {
  const { plugin, t } = ctx;
  const nlpEnabled = (): boolean => plugin.settings.enableNLP;

  return {
    type: 'group',
    heading: t('settings.sections.features'),
    items: [
      {
        name: t('settings.features.enableDatePicker.name'),
        desc: t('settings.features.enableDatePicker.desc'),
        control: { type: 'toggle', key: 'enableDatePicker' },
      },
      {
        name: t('settings.features.enableNLP.name'),
        desc: t('settings.features.enableNLP.desc'),
        control: { type: 'toggle', key: 'enableNLP' },
      },
      {
        name: t('settings.features.nlpAutoDetect.name'),
        desc: t('settings.features.nlpAutoDetect.desc'),
        visible: nlpEnabled,
        control: { type: 'toggle', key: 'nlpAutoDetectLanguage' },
      },
      {
        name: t('settings.features.nlpStrictMode.name'),
        desc: t('settings.features.nlpStrictMode.desc'),
        visible: nlpEnabled,
        control: {
          type: 'dropdown',
          key: 'nlpStrictMode',
          options: {
            false: t('settings.features.nlpStrictMode.casual'),
            true: t('settings.features.nlpStrictMode.strict'),
          },
        },
      },
      {
        name: t('settings.features.nlpShowWarning.name'),
        desc: t('settings.features.nlpShowWarning.desc'),
        visible: nlpEnabled,
        control: { type: 'toggle', key: 'showParsingWarning' },
      },
    ],
  };
}
