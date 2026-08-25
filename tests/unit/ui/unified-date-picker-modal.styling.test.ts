/**
 * @jest-environment jsdom
 *
 * The shipped stylesheet and the rendered DOM are two halves of one contract,
 * and nothing tied them together: the modal's sizing rule targeted a descendant
 * it never produced, so that rule was inert while the tests stayed green.
 *
 * These tests inject the real `styles.css` into the document and read
 * `getComputedStyle` off the real rendered modal, so an assertion fails when a
 * selector stops reaching its element — not merely when someone edits the line
 * above it. jsdom resolves the cascade but performs no layout, so this proves
 * which declarations apply, never what they measure; the measured figures live
 * in `docs/testing/modal-layout-and-published-assets_manual_test_plan.md`.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** Every file under `dir`, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(nom => {
    const chemin = join(dir, nom);
    return statSync(chemin).isDirectory() ? walk(chemin) : [chemin];
  });
}
import { App } from 'obsidian';
import { createMockApp } from '../../helpers/mock-app';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { I18nService } from '@/services/i18n-service';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';

/** The single stylesheet Obsidian loads for this plugin. */
const STYLES = readFileSync(join(__dirname, '../../../styles.css'), 'utf8');

/** `styles.css` with every `@media` block removed, so root rules are unambiguous. */
const ROOT_STYLES = STYLES.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

/**
 * Declarations of a root-level rule. Only `scrollbar-gutter` needs this — jsdom
 * models everything else in this file, and reading the cascade off the rendered
 * modal proves the rule reaches its element, which reading text cannot. Throws
 * rather than guessing
 * when the selector is missing or appears twice — a silent first-match would
 * read a conditional rule as an unconditional one.
 *
 * Comments are stripped: a comment explaining why a property is there names
 * that property, so an assertion would otherwise match the explanation of a
 * declaration that had been deleted.
 */
function rootRuleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [
    ...ROOT_STYLES.matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'gm')),
  ];
  if (matches.length !== 1) {
    throw new Error(`${selector}: expected exactly one root-level rule, found ${matches.length}`);
  }
  return matches[0][1].replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('UnifiedDatePickerModal styling contract', () => {
  let app: App;
  let dateService: DateService;
  let formatterService: FormatterService;
  let nlpService: NLPService;
  let i18n: I18nService;
  let dailyNotesService: DailyNotesService;
  let settings: DateHelpersSettings;
  let datePresets: FormatPreset[];
  let styleEl: HTMLStyleElement;

  beforeEach(() => {
    styleEl = document.createElement('style');
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);

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
  });

  /** Every modal opened by a test, closed in afterEach. */
  let opened: UnifiedDatePickerModal[] = [];

  afterEach(() => {
    // Closing cancels the deferred initial focus. Left pending, it fires during
    // a later test against a DOM this hook has already detached.
    opened.forEach(m => m.onClose());
    opened = [];
    styleEl.remove();
    document.body.replaceChildren();
  });

  function openModal(): UnifiedDatePickerModal {
    const modal = new UnifiedDatePickerModal(
      app,
      dateService,
      formatterService,
      nlpService,
      i18n,
      dailyNotesService,
      datePresets,
      settings,
      jest.fn(),
      jest.fn().mockResolvedValue(undefined)
    );
    modal.onOpen();
    opened.push(modal);
    return modal;
  }

  /** Computed style of the first element matching `selector` inside this modal. */
  function styleOf(modal: UnifiedDatePickerModal, selector: string): CSSStyleDeclaration {
    const el = (modal.modalEl as HTMLElement).querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`no element matching ${selector} in the rendered modal`);
    return getComputedStyle(el);
  }

  describe('the modal carries its own size', () => {
    // Where the class sits is pinned by the characterization test in
    // `unified-date-picker-modal.render.test.ts`; every assertion below fails
    // too if it moves, since the rules stop reaching their elements.

    it('caps its width and floors it without overflowing a narrow shell', () => {
      const modal = openModal();
      const modalStyle = getComputedStyle(modal.modalEl as HTMLElement);

      expect(modalStyle.maxWidth).toBe('450px');
      // `min(…, 100%)`, not a bare 360px: Obsidian's own `.modal` is
      // `min(560px, 80vw)`, and a fixed floor overflows it on a narrow window.
      expect(modalStyle.minWidth).toBe('min(360px, 100%)');
    });

    it('stacks its content and lets it shrink, so the shell never scrolls', () => {
      const modal = openModal();
      const content = getComputedStyle(modal.contentEl as HTMLElement);

      expect(content.display).toBe('flex');
      expect(content.flexDirection).toBe('column');
      expect(content.minHeight).toBe('0');
      // No cap here — `.modal` already caps itself at 85vh, and a second cap
      // plus the shell's padding exceeded it and made the shell scroll.
      expect(content.maxHeight).toBe('');
    });
  });

  describe('the calendar takes the overflow', () => {
    it('scrolls the day grid rather than the modal', () => {
      const modal = openModal();
      const grid = styleOf(modal, '.date-picker-day-grid');

      expect(grid.overflowY).toBe('auto');
      // Without a height floor a flex item will not shrink below its content,
      // and the overflow rule never engages.
      expect(grid.minHeight).toBe('0');
    });

    it('paints the focus ring inside the day, never on its edge', () => {
      const modal = openModal();
      const focused = styleOf(modal, '.date-picker-day.is-focused');

      // An `outline` is a stroke on the box's boundary. The grid clips
      // horizontally — `overflow-y: auto` makes `overflow-x` compute to `auto`
      // — and `repeat(7, 1fr)` puts the Sunday column's edge on a fractional
      // pixel, so the right-hand stroke sat on the clip boundary. On a scaled
      // display, where the framebuffer is resampled before it reaches the
      // panel, that stroke disappeared. An inset shadow is painted inside the
      // box instead, so nothing depends on an edge pixel surviving.
      expect(focused.boxShadow).toMatch(/inset/);
      expect(focused.boxShadow).toMatch(/2px/);
      // `none`, not absent: the rule now states it, which is what keeps the
      // app's own ring off the boundary.
      expect(focused.outline).toBe('none');
    });

    it('gives the keyboard focus ring the same inside treatment', () => {
      // The day cells take real DOM focus after every redraw, so
      // `:focus-visible` applies to them too — and its ring was offset
      // *outwards*, which the grid clips outright.
      //
      // Read from the file, not the cascade. jsdom does not resolve
      // pseudo-classes: `getComputedStyle(cell, ':focus-visible')` returns an
      // empty declaration, since that argument is for pseudo-*elements*.
      // Measured, after a review claimed the opposite.
      const rule = rootRuleBody('.date-picker-day.is-focused,\n.date-picker-day:focus-visible');

      expect(rule).toMatch(/box-shadow:\s*inset/);
      // `outline: none` is load-bearing, not tidiness: drop it and the app's
      // own focus ring draws on the boundary again, which is the defect.
      expect(rule).toMatch(/outline:\s*none/);
      expect(rule).not.toMatch(/outline-offset:\s*2px/);
    });

    it('keeps a focus indicator when the user forces colours', () => {
      // Forced-colors mode (Windows high contrast, which Chromium honours and
      // Obsidian inherits) overrides `box-shadow` to `none` while preserving
      // `outline`. Moving the ring to an inset shadow therefore left a
      // keyboard-first calendar with no focus indicator at all under that
      // setting. The fallback is an outline offset *inwards*, so it does not
      // reintroduce the clipped-edge defect.
      //
      // Read from the file: jsdom evaluates no media query.
      const block = /@media\s*\(forced-colors:\s*active\)\s*\{([\s\S]*?)\n\}/.exec(STYLES);

      expect(block).not.toBeNull();
      expect(block![1]).toMatch(/\.date-picker-day\.is-focused/);
      expect(block![1]).toMatch(/\.date-picker-day:focus-visible/);
      expect(block![1]).toMatch(/outline:\s*2px solid/);
      expect(block![1]).toMatch(/outline-offset:\s*-2px/);
    });

    it('holds the label row at its natural height', () => {
      const modal = openModal();
      const labels = styleOf(modal, '.date-picker-day-labels');

      // Making the row a scroll container for the gutter also changed its
      // automatic minimum size: a flex item that scrolls resolves `min-height`
      // to 0 instead of `auto`, so it became compressible and would clip its
      // own labels when the modal ran short. Only the grid should absorb that.
      expect(labels.flexShrink).toBe('0');
    });

    it('reserves the scrollbar gutter on the grid and its labels alike', () => {
      // jsdom drops `scrollbar-gutter`, so this one is read from the file.
      // Both rows must reserve it: only the grid scrolls, and on a platform
      // with classic scrollbars its seven columns would otherwise slide out
      // from under seven full-width labels.
      const modal = openModal();

      expect(rootRuleBody('.date-picker-day-grid')).toMatch(/scrollbar-gutter:\s*stable/);
      expect(rootRuleBody('.date-picker-day-labels')).toMatch(/scrollbar-gutter:\s*stable/);
      // The labels row is not otherwise a scroll container, and
      // `scrollbar-gutter` applies to nothing else.
      expect(styleOf(modal, '.date-picker-day-labels').overflowY).toBe('auto');
    });
  });

  describe('the action tabs fit the bounded width', () => {
    it('keeps a square that no label can stretch', () => {
      const modal = openModal();
      const button = styleOf(modal, '.action-button');

      // The tabs used to grow and wrap, because their labels varied in length:
      // three of them pinned at 131px each clipped the middle one, and letting
      // them wrap sent the third onto a line of its own, squeezing the field
      // beside them down to a stub. They carry an icon and no text now, so the
      // stylesheet alone decides their width.
      expect(button.width).toBe('34px');
      expect(button.height).toBe('34px');
      expect(button.flexGrow).toBe('0');
      expect(button.flexShrink).toBe('0');
    });
  });

  describe('the footer', () => {
    it('lays its controls out on one row with a gap, so they do not touch', () => {
      const modal = openModal();
      const footer = styleOf(modal, '.date-picker-footer');

      // The footer is a column now — the result line above, the actions below.
      // The row that must not have its controls touching is the actions one.
      expect(footer.display).toBe('flex');
      expect(footer.flexDirection).toBe('column');
      expect(footer.gap).toBe('8px');

      const actions = styleOf(modal, '.date-picker-actions');
      expect(actions.display).toBe('flex');
      expect(actions.alignItems).toBe('center');
    });

    // The class alone is not the colour. The field carried `is-error` while the
    // stylesheet said nothing about it, so the border stayed grey and the
    // manual pass marked the check failed on code that looked done.
    // jsdom resolves the cascade but not custom properties, so both colours read
    // back as the empty string. What is provable here is that the rule exists,
    // targets the class the code applies, and names a different colour than the
    // ordinary field. That it *renders* differently is measured by the CDP tir.
    it('has a rule painting the field border when the expression fails to parse', () => {
      const modal = openModal();
      const field = (modal.modalEl as HTMLElement).querySelector<HTMLInputElement>('.nlp-input');
      if (!field) throw new Error('NLP field missing');

      const failing = rootRuleBody(".nlp-input-container input[type='text'].is-error");
      expect(failing).toContain('border-color');
      expect(failing).toContain('var(--text-error)');

      const ordinary = rootRuleBody(".nlp-input-container input[type='text']");
      expect(ordinary).not.toContain('--text-error');
    });

    // A `<select>` is as wide as its longest option, and one of its options
    // carries the whole selected text. With a long selection the control took
    // the full row and pushed `Today` and `Insert` outside the modal — measured
    // at 450 px wide with the buttons ending at 1019 px.
    it('lets the format selector shrink, and never the two buttons', () => {
      const modal = openModal();
      const select = styleOf(modal, '.date-picker-format-selector');

      expect(select.minWidth).toBe('0');
      expect(select.flexShrink).toBe('1');

      for (const selector of ['.date-picker-today-button', '.date-picker-insert-button']) {
        expect(styleOf(modal, selector).flexShrink).toBe('0');
      }
    });
  });

  describe('the stylesheet selects only classes the code applies', () => {
    // The named check below only ever looked for one literal, so it missed the
    // four `.nlp-preview*` rules that outlived the element they painted — 22
    // lines the pre-merge review found by hand. This reads every class the
    // plugin owns out of the stylesheet and asks `src/` whether anything still
    // writes it.
    //
    // Ours by prefix: Obsidian's own classes (`.modal`, `.suggestion-item`,
    // `.theme-dark`) are not this plugin's to justify.
    it('applies every class it selects', () => {
      const PREFIXES = ['date-picker-', 'date-suggest-', 'nlp-', 'action-', 'unified-date-picker'];
      const css = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
      const selected = new Set(
        [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)]
          .map(m => m[1])
          .filter(nom => PREFIXES.some(p => nom.startsWith(p)))
      );

      const sources = ['src/ui', 'src/services']
        .flatMap(dir => walk(join(__dirname, '../../../', dir)))
        .map(f => readFileSync(f, 'utf8'))
        .join('\n');

      const orphelines = [...selected].filter(nom => !sources.includes(nom)).sort();
      expect(orphelines).toEqual([]);
    });

    it('greys the alias field, and says so in a rule of its own', () => {
      // jsdom resolves no custom property, so the painted colour is proved at
      // the CDP pass; what a unit test can pin is that the rule exists, that it
      // is keyed on the disabled state, and that it dims rather than hides.
      const body = rootRuleBody('.date-picker-alias:disabled');

      expect(body).toMatch(/color:\s*var\(--text-muted\)/);
      expect(body).not.toMatch(/display:\s*none/);
    });

    it('lets a long alias scroll instead of wrapping the footer', () => {
      const body = rootRuleBody('.date-picker-alias');

      expect(body).toMatch(/font-family:\s*var\(--font-monospace\)/);
      expect(body).toMatch(/width:\s*100%/);
      // Un `<input>` fait défiler son contenu tout seul ; le clipper, c'est
      // cacher la fin de l'alias au lieu de laisser le caret l'atteindre.
      // (`white-space: normal` ne s'écrit jamais : l'assertion serait vide.)
      expect(body).not.toMatch(/text-overflow|overflow:\s*hidden/);
    });

    // Le garde-fou ci-dessus va du CSS vers le code. Le sens inverse manquait,
    // et c'est celui qui a laissé passer un renommage : `.date-picker-result`
    // est devenue `.date-picker-alias` dans la feuille pendant que le code
    // continuait de poser les deux — la ligne de « Open daily note » a perdu
    // sa bordure, sa monospace et son `nowrap` sans qu'un test bronche.
    it('styles every class it applies', () => {
      const PREFIXES = ['date-picker-', 'date-suggest-', 'nlp-', 'action-', 'unified-date-picker'];
      const sources = ['src/ui', 'src/services']
        .flatMap(dir => walk(join(__dirname, '../../../', dir)))
        .map(f => readFileSync(f, 'utf8'))
        .join('\n');

      // Les classes que le code POSE : `cls: '…'`, `addClass('…')`,
      // `classList.toggle('…')`. Pas les sélecteurs qu'il interroge.
      const posees = new Set(
        [
          ...sources.matchAll(/cls:\s*'([^']+)'/g),
          ...sources.matchAll(/(?:addClass|classList\.(?:add|toggle))\(\s*'([^']+)'/g),
        ]
          .flatMap(m => m[1].split(/\s+/))
          .filter(nom => PREFIXES.some(p => nom.startsWith(p)))
      );

      // `date-suggest-held-label` n'a jamais eu de règle, sur `main` non plus :
      // le span hérite du style de `.date-suggest-held`, ses trois voisins ont
      // la leur. Nommé ici plutôt que toléré en silence — si quelqu'un lui
      // donne un style un jour, cette ligne s'en va.
      const SANS_STYLE_ASSUME = ['date-suggest-held-label'];

      const css = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
      const sansRegle = [...posees]
        .filter(nom => !SANS_STYLE_ASSUME.includes(nom))
        .filter(nom => !css.includes(`.${nom}`))
        .sort();
      expect(sansRegle).toEqual([]);
    });

    it('no longer selects the class no code applies', () => {
      // Comments stripped: one of them recounts why `.date-picker-modal` went
      // away, and that history is worth keeping in the file.
      const selectors = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');

      expect(selectors).not.toMatch(/(?<!unified-)date-picker-modal/);
    });

    it('keeps a narrow-viewport escape hatch for the width floor', () => {
      const media = /@media[^{]*max-width:\s*400px[^{]*\{([\s\S]*?)\n\}/.exec(STYLES);
      expect(media).not.toBeNull();
      expect(media![1]).toMatch(/\.unified-date-picker-modal\s*\{[^}]*min-width/);
    });
  });
});
