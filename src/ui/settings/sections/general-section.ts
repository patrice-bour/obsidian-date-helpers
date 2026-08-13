import type { SettingDefinitionGroup } from 'obsidian';
import { isValidLocale, normalizeLocale } from '@/utils/locale';
import { SettingsKey, SettingsSectionContext } from '../section-context';

/**
 * General section: locale and week start.
 *
 * The locale field validates through the control's own `validate` hook, so an
 * unknown code surfaces an inline error instead of being persisted silently.
 *
 * Note what this does *not* guarantee: acceptance is decided on the normalized
 * form, so `fr_CA` passes here. Normalizing before storage is the settings tab's
 * job, in the write funnel — see CONTROL_COERCIONS.
 */
export function buildGeneralSection(ctx: SettingsSectionContext): SettingDefinitionGroup<SettingsKey> {
  const { t } = ctx;

  return {
    type: 'group',
    heading: t('settings.sections.general'),
    items: [
      {
        name: t('settings.locale.name'),
        desc: t('settings.locale.desc'),
        control: {
          type: 'text',
          key: 'locale',
          placeholder: t('settings.locale.placeholder'),
          validate: value => (isAcceptedLocale(value) ? undefined : t('settings.locale.invalid')),
        },
      },
      {
        name: t('settings.weekStart.name'),
        desc: t('settings.weekStart.desc'),
        control: {
          type: 'dropdown',
          key: 'weekStart',
          options: {
            '0': t('settings.weekStart.sunday'),
            '1': t('settings.weekStart.monday'),
            '6': t('settings.weekStart.saturday'),
          },
        },
      },
    ],
  };
}

/**
 * An empty field means "follow Obsidian" and is stored as `auto`; anything else
 * must resolve to a locale the platform knows.
 */
function isAcceptedLocale(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'auto') return true;
  return isValidLocale(normalizeLocale(trimmed));
}
