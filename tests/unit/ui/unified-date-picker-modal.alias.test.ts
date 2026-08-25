/**
 * @jest-environment jsdom
 *
 * The alias field: the footer line the user can write in, whose text is the
 * alias the wikilink carries.
 */

import { App } from 'obsidian';
import { createMockApp } from '../../helpers/mock-app';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { I18nService } from '@/services/i18n-service';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { SELECTED_TEXT_SOURCE, TYPED_TEXT_SOURCE } from '@/types/alias-source';

type DateAction = 'insert-text' | 'insert-daily-note' | 'open-daily-note';

describe('the alias field', () => {
  let app: App;
  let dateService: DateService;
  let formatterService: FormatterService;
  let nlpService: NLPService;
  let i18n: I18nService;
  let dailyNotesService: DailyNotesService;
  let settings: DateHelpersSettings;
  let datePresets: FormatPreset[];
  let onSelect: jest.Mock;
  let saveSettings: jest.Mock;

  beforeEach(() => {
    app = createMockApp();
    dateService = new DateService('en-US');
    formatterService = new FormatterService('en-US');
    i18n = new I18nService('en');
    settings = { ...DEFAULT_SETTINGS };

    const mockI18nService = {
      getCurrentLocale: jest.fn().mockReturnValue('en-US'),
      t: jest.fn((key: string) => key),
      setLocale: jest.fn(),
    };
    nlpService = new NLPService(dateService, mockI18nService as never, settings);
    dailyNotesService = new DailyNotesService(app, formatterService, i18n, settings);
    datePresets = DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date');
    onSelect = jest.fn();
    saveSettings = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  function openModal(
    initialAction: DateAction = 'insert-daily-note',
    initialNLPText?: string,
    selectionText?: string
  ): UnifiedDatePickerModal {
    const modal = new UnifiedDatePickerModal(
      app,
      dateService,
      formatterService,
      nlpService,
      i18n,
      dailyNotesService,
      datePresets,
      settings,
      onSelect,
      saveSettings,
      initialAction,
      initialNLPText,
      selectionText
    );
    modal.onOpen();
    return modal;
  }

  function content(modal: UnifiedDatePickerModal): HTMLElement {
    return modal.contentEl as HTMLElement;
  }

  function aliasField(modal: UnifiedDatePickerModal): HTMLInputElement | null {
    return content(modal).querySelector<HTMLInputElement>('.date-picker-alias');
  }

  function requireAliasField(modal: UnifiedDatePickerModal): HTMLInputElement {
    const field = aliasField(modal);
    if (!field) throw new Error('alias field not found');
    return field;
  }

  function nlpInput(modal: UnifiedDatePickerModal): HTMLInputElement {
    const input = content(modal).querySelector<HTMLInputElement>('.nlp-input');
    if (!input) throw new Error('NLP input not found');
    return input;
  }

  function typeNLP(modal: UnifiedDatePickerModal, text: string): void {
    const input = nlpInput(modal);
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  function typeAlias(modal: UnifiedDatePickerModal, text: string): void {
    const field = requireAliasField(modal);
    field.value = text;
    field.dispatchEvent(new Event('input'));
  }

  function formatSelector(modal: UnifiedDatePickerModal): HTMLSelectElement {
    const select = content(modal).querySelector<HTMLSelectElement>('.date-picker-format-selector');
    if (!select) throw new Error('format selector not found');
    return select;
  }

  function pickOption(modal: UnifiedDatePickerModal, value: string): void {
    const select = formatSelector(modal);
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  type KeyHandler = (evt?: unknown) => boolean | void;
  function invokeKey(modal: UnifiedDatePickerModal, mods: string[], key: string): boolean | void {
    const scope = (modal as unknown as { scope: { register: jest.Mock } }).scope;
    const calls = scope.register.mock.calls as Array<[string[], string, KeyHandler]>;
    const binding = calls.find(
      ([m, k]) => k === key && m.length === mods.length && mods.every(mod => m.includes(mod))
    );
    if (!binding) throw new Error(`No binding for ${mods.join('+')}+${key}`);
    return binding[2]();
  }

  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  describe('when it is there at all', () => {
    it('is absent with no selection and no typed text', () => {
      const modal = openModal();

      expect(aliasField(modal)).toBeNull();
    });

    it('comes in as soon as an expression is typed, holding it', () => {
      const modal = openModal();

      typeNLP(modal, 'point hebdo');

      expect(requireAliasField(modal).value).toBe('point hebdo');
    });

    it('goes away again when the expression is cleared', () => {
      const modal = openModal();
      typeNLP(modal, 'point hebdo');

      typeNLP(modal, '');

      expect(aliasField(modal)).toBeNull();
    });

    it('holds the captured selection, and lets it be edited', () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');
      const field = requireAliasField(modal);

      expect(field.value).toBe('réunion de cadrage');
      expect(field.tagName).toBe('INPUT');
      expect(field.readOnly).toBe(false);
      expect(field.disabled).toBe(false);
    });

    it('is absent on the actions that write no alias', () => {
      const text = openModal('insert-text', undefined, 'réunion de cadrage');
      expect(aliasField(text)).toBeNull();

      const open = openModal('open-daily-note', undefined, 'réunion de cadrage');
      expect(aliasField(open)).toBeNull();
    });
  });

  describe('the action that chooses nothing still names the day', () => {
    // No alias and no selector on the open action: the footer would say
    // nothing at all about what confirming does. The read-only line stays
    // there, and only there.
    it('shows what opening would navigate to', () => {
      const modal = openModal('open-daily-note');
      const line = content(modal).querySelector('.date-picker-result');

      expect(line?.textContent).toContain('Open: ');
      expect(line?.textContent).toContain(
        formatterService.formatWithPreset(modal.getFocusedDay(), modal.getSelectedPreset())
      );
    });

    it('follows the focused day', () => {
      const modal = openModal('open-daily-note');
      modal.navigateDay('next');

      const line = content(modal).querySelector('.date-picker-result');
      expect(line?.textContent).toContain(
        formatterService.formatWithPreset(modal.getFocusedDay(), modal.getSelectedPreset())
      );
    });

    it('is absent on the actions whose selector carries the preview', () => {
      expect(content(openModal('insert-text')).querySelector('.date-picker-result')).toBeNull();
      expect(
        content(openModal('insert-daily-note')).querySelector('.date-picker-result')
      ).toBeNull();
    });
  });

  describe('what the edit reaches', () => {
    it('inserts the edited alias, not the captured selection', async () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');

      typeAlias(modal, 'réunion de lancement');
      await modal.selectFocusedDay();

      const [inserted] = onSelect.mock.calls[0];
      expect(inserted).toContain('|réunion de lancement]]');
    });

    it('shows the edit in the selector, which is the preview surface', () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');

      typeAlias(modal, 'point hebdo');

      const select = formatSelector(modal);
      expect(select.options[select.selectedIndex].text).toContain('|point hebdo]]');
    });

    it('does not re-attach an edit to an expression typed later', async () => {
      // L'alias a été écrit pour un texte que l'utilisateur a ensuite effacé
      // par une interaction calendrier. Le recoller sur l'expression suivante
      // insérerait un mot écrit pour autre chose.
      const modal = openModal('insert-daily-note');
      typeNLP(modal, 'réunion de cadrage');
      typeAlias(modal, 'Réunion Acme');

      modal.jumpToToday();
      expect(aliasField(modal)).toBeNull();

      typeNLP(modal, 'point hebdo');
      expect(requireAliasField(modal).value).toBe('point hebdo');
      await modal.selectFocusedDay();
      expect(onSelect.mock.calls[0][0]).toContain('|point hebdo]]');
    });

    it('holds an expression that parses, like one that does not', () => {
      // Le chemin de succès de `updateNLPPreview` ne passe pas par les mêmes
      // lignes que le chemin d'échec, et lui seul construisait le champ.
      const modal = openModal('insert-daily-note');
      typeNLP(modal, 'tomorrow');

      expect(requireAliasField(modal).value).toBe('tomorrow');
    });

    it('falls back to a formatted alias when the field is emptied', async () => {
      settings.dailyNotesAliasFallbackPresetId = 'iso8601';
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');

      typeAlias(modal, '');
      await modal.selectFocusedDay();

      const [inserted] = onSelect.mock.calls[0];
      const day = modal.getFocusedDay().toFormat('yyyy-MM-dd');
      expect(inserted).toBe(`[[${day}|${day}]]`);
      // Emptied, not gone: there is still a field to type in
      expect(aliasField(modal)).not.toBeNull();
    });
  });

  describe('the selector promises what the insertion writes', () => {
    // Le chemin du lien était déjà tenu par `aliasOptionsForOption`. Celui du
    // texte avait encore deux constructions parallèles, et c'est la classe de
    // défaut que ce projet a déjà payée une fois.
    it('agrees on the text action, whatever preset is active', async () => {
      const modal = openModal('insert-text');
      const select = formatSelector(modal);

      for (const id of ['iso8601', 'locale-long', 'date-verbose']) {
        onSelect.mockClear();
        pickOption(modal, id);
        const promis = select.options[select.selectedIndex].text;

        await modal.selectFocusedDay();
        expect(onSelect.mock.calls[0][0]).toBe(promis);
      }
    });

    it('agrees on the link action, alias or preset', async () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');
      const select = formatSelector(modal);

      for (const id of [SELECTED_TEXT_SOURCE, 'iso8601', SELECTED_TEXT_SOURCE]) {
        onSelect.mockClear();
        pickOption(modal, id);
        const promis = select.options[select.selectedIndex].text;

        await modal.selectFocusedDay();
        expect(onSelect.mock.calls[0][0]).toBe(promis);
      }
    });
  });

  describe('the footer keeps its order', () => {
    it('puts the field above the actions, not after them', () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');
      const footer = content(modal).querySelector('.date-picker-footer');
      const classes = Array.from(footer?.children ?? []).map(e => e.className);

      expect(classes[0]).toContain('date-picker-alias');
      expect(classes[classes.length - 1]).toContain('date-picker-actions');
    });

    it('puts a field that arrives later above them too', () => {
      // Le champ né d'une frappe est inséré dans un pied déjà bâti : c'est le
      // chemin où l'ordre peut se perdre.
      const modal = openModal('insert-daily-note');
      typeNLP(modal, 'point hebdo');

      const footer = content(modal).querySelector('.date-picker-footer');
      const classes = Array.from(footer?.children ?? []).map(e => e.className);
      expect(classes[0]).toContain('date-picker-alias');
      expect(classes[classes.length - 1]).toContain('date-picker-actions');
    });
  });

  describe('the reversible greying', () => {
    it('greys out when a format output is picked, and keeps showing the alias', () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');

      pickOption(modal, 'iso8601');

      const field = requireAliasField(modal);
      expect(field.disabled).toBe(true);
      expect(field.value).toBe('réunion de cadrage');
    });

    it('does not consume the selection, and inserts nothing', () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');

      pickOption(modal, 'iso8601');

      expect(onSelect).not.toHaveBeenCalled();
      const select = formatSelector(modal);
      const source = Array.from(select.options).find(o => o.value === SELECTED_TEXT_SOURCE);
      expect(source?.text).toContain('|réunion de cadrage]]');
    });

    it('greyed, it shows the source that was active — not another one', () => {
      // Deux sources offertes : la sélection et le texte tapé. Le champ grisé
      // annonce ce qui reviendra ; annoncer l'autre source serait un mensonge.
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');
      typeNLP(modal, 'point hebdo');
      pickOption(modal, TYPED_TEXT_SOURCE);
      expect(requireAliasField(modal).value).toBe('point hebdo');

      pickOption(modal, 'iso8601');
      expect(requireAliasField(modal).disabled).toBe(true);
      expect(requireAliasField(modal).value).toBe('point hebdo');

      pickOption(modal, TYPED_TEXT_SOURCE);
      expect(requireAliasField(modal).value).toBe('point hebdo');
    });

    it('relabels the format options when the active one changes', () => {
      // La source retombe sur le preset actif quand son texte ne peut pas
      // parler pour le jour : changer de preset change alors CE que son
      // étiquette montre, pas seulement laquelle est cochée.
      const modal = openModal('insert-daily-note', undefined, 'tomorrow');
      // Le champ d'expression porte une copie de la sélection ; le vider avant
      // de naviguer, sinon choisir une option relance la prévisualisation, qui
      // reparse l'expression et ramène le jour focalisé sur celui qu'elle nomme.
      typeNLP(modal, '');
      modal.navigateDay('next');
      const select = formatSelector(modal);
      const source = () =>
        Array.from(select.options).find(o => o.value === SELECTED_TEXT_SOURCE)?.text ?? '';

      const avant = source();
      pickOption(modal, 'iso8601');

      expect(source()).not.toBe(avant);
      const day = modal.getFocusedDay().toFormat('yyyy-MM-dd');
      expect(source()).toBe(`[[${day}|${day}]]`);
    });

    it('comes back enabled, with the text unchanged, on the alias output', () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');

      pickOption(modal, 'iso8601');
      pickOption(modal, SELECTED_TEXT_SOURCE);

      const field = requireAliasField(modal);
      expect(field.disabled).toBe(false);
      expect(field.value).toBe('réunion de cadrage');
    });

    it('holds the edited text through the round trip, not the original', async () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');

      typeAlias(modal, 'réunion de lancement');
      pickOption(modal, 'iso8601');
      pickOption(modal, SELECTED_TEXT_SOURCE);

      expect(requireAliasField(modal).value).toBe('réunion de lancement');
      await modal.selectFocusedDay();
      expect(onSelect.mock.calls[0][0]).toContain('|réunion de lancement]]');
    });

    it('stays editable when the held text may not speak for the focused day', async () => {
      // The selection parses, so the picker opens on the day it names. Move
      // off that day and the text may no longer alias it — the selector says
      // so, and the field stays open, because editing is the way out.
      settings.dailyNotesAliasFallbackPresetId = 'iso8601';
      const modal = openModal('insert-daily-note', undefined, 'tomorrow');
      const select = formatSelector(modal);

      expect(select.options[select.selectedIndex].text).toContain('|tomorrow]]');

      modal.navigateDay('next');

      const field = requireAliasField(modal);
      expect(field.disabled).toBe(false);
      expect(field.value).toBe('tomorrow');
      const day = modal.getFocusedDay().toFormat('yyyy-MM-dd');
      expect(select.options[select.selectedIndex].text).toBe(`[[${day}|${day}]]`);

      typeAlias(modal, 'réunion de cadrage');
      await modal.selectFocusedDay();
      expect(onSelect.mock.calls[0][0]).toBe(`[[${day}|réunion de cadrage]]`);
    });
  });

  describe('the keyboard, with one more field in the footer', () => {
    it('confirms on Enter from the alias field', async () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');
      requireAliasField(modal).focus();

      invokeKey(modal, [], 'Enter');
      await flushPromises();

      expect(onSelect).toHaveBeenCalled();
    });

    it('leaves the arrows to the caret while the field holds text', () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');
      const before = modal.getFocusedDay();
      requireAliasField(modal).focus();

      expect(invokeKey(modal, [], 'ArrowRight')).toBe(true);
      expect(invokeKey(modal, [], 'ArrowLeft')).toBe(true);
      expect(invokeKey(modal, [], 'Home')).toBe(true);
      expect(modal.getFocusedDay().toISODate()).toBe(before.toISODate());
    });

    // Le champ vidé est le moment où l'utilisateur va réécrire : c'est là qu'il
    // a le plus besoin des flèches, et là que la règle « vide → le calendrier »
    // du champ d'expression lui coûterait tout.
    it('leaves the arrows to an EMPTIED alias field', () => {
      const modal = openModal('insert-daily-note');
      typeNLP(modal, 'réunion de cadrage');
      const before = modal.getFocusedDay();

      typeAlias(modal, '');
      requireAliasField(modal).focus();

      expect(invokeKey(modal, [], 'ArrowLeft')).toBe(true);
      expect(invokeKey(modal, [], 'Home')).toBe(true);
      expect(invokeKey(modal, ['Mod'], 'ArrowLeft')).toBe(true);
      expect(modal.getFocusedDay().toISODate()).toBe(before.toISODate());
      // Ce que la frappe aurait détruit : l'expression, et le champ avec elle
      expect(nlpInput(modal).value).toBe('réunion de cadrage');
      expect(aliasField(modal)).not.toBeNull();
    });

    it('still gives the arrows to the calendar from an empty EXPRESSION field', () => {
      // La règle inverse tient pour l'autre champ : le picker s'ouvre dessus,
      // donc un champ vide ne doit pas rendre le calendrier inatteignable.
      const modal = openModal('insert-daily-note');
      const before = modal.getFocusedDay();
      nlpInput(modal).focus();

      expect(invokeKey(modal, [], 'ArrowRight')).toBe(false);
      expect(modal.getFocusedDay().toISODate()).toBe(before.plus({ days: 1 }).toISODate());
    });

    it("leaves 't' to the field, so the alias can hold one", () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');
      requireAliasField(modal).focus();

      expect(invokeKey(modal, [], 't')).toBe(true);
    });

    it('still answers the arrows when the focus is elsewhere', () => {
      const modal = openModal('insert-daily-note', undefined, 'réunion de cadrage');
      const before = modal.getFocusedDay();

      expect(invokeKey(modal, [], 'ArrowRight')).toBe(false);
      expect(modal.getFocusedDay().toISODate()).toBe(before.plus({ days: 1 }).toISODate());
    });
  });
});
