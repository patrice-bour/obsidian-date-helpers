/**
 * Mock Obsidian API for testing
 */

export class Plugin {
  app: any;
  manifest: any;

  constructor(app?: any, manifest?: any) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand = jest.fn((_command: any): void => {});
  addSettingTab = jest.fn((_tab: any): void => {});
  registerEditorSuggest = jest.fn((_suggest: any): void => {});
  loadData = jest.fn(async (): Promise<any> => ({}));
  saveData = jest.fn(async (_data: any): Promise<void> => {});
  registerEvent(_event: any): void {}
  registerDomEvent = jest.fn((_el: any, _type: string, _handler: any, _options?: any): void => {});
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any;
  settingItems: any[] = [];

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl =
      typeof document !== 'undefined' ? document.createElement('div') : createMockElement();
  }

  getSettingDefinitions(): any[] {
    return [];
  }

  /**
   * Stores the definitions and re-renders. Mocked as a spy: tests assert that a
   * structural change asks for a rebuild, not what the rebuild draws.
   */
  update = jest.fn((): void => {
    this.settingItems = this.getSettingDefinitions();
  });

  /** Re-evaluates `visible`/`disabled` predicates in place. */
  refreshDomState = jest.fn((): void => {});

  /**
   * Obsidian's default reads from `plugin.settings` and persists with
   * `saveData()` — deliberately mirrored here, so a subclass that forgets to
   * override and route through its own save path fails a test.
   */
  getControlValue(key: string): unknown {
    return this.plugin?.settings?.[key];
  }

  setControlValue(key: string, value: unknown): void | Promise<void> {
    this.plugin.settings[key] = value;
    return this.plugin.saveData(this.plugin.settings);
  }

  display(): void {}
  hide(): void {}
}

export class Setting {
  settingEl: any;
  private nameEl: any;
  private descEl: any;
  private controlEl: any;
  private hasDom: boolean;

  constructor(containerEl: HTMLElement) {
    // DOM-aware under jsdom (requires obsidian-dom helpers); inert in node env.
    this.hasDom = typeof document !== 'undefined' && !!(containerEl as any)?.createDiv;
    if (this.hasDom) {
      const el = containerEl as any;
      this.settingEl = el.createDiv({ cls: 'setting-item' });
      const info = this.settingEl.createDiv({ cls: 'setting-item-info' });
      this.nameEl = info.createDiv({ cls: 'setting-item-name' });
      this.descEl = info.createDiv({ cls: 'setting-item-description' });
      this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
    }
  }

  setName(name: string): this {
    if (this.hasDom) this.nameEl.setText(name);
    return this;
  }

  setDesc(desc: string): this {
    if (this.hasDom) this.descEl.setText(desc);
    return this;
  }

  setHeading(): this {
    if (this.hasDom) this.settingEl.addClass('setting-item-heading');
    return this;
  }

  setClass(cls: string): this {
    if (this.hasDom) this.settingEl.addClass(cls);
    return this;
  }

  addText(cb: (text: any) => any): this {
    if (this.hasDom) {
      const inputEl = this.controlEl.createEl('input') as HTMLInputElement;
      inputEl.type = 'text';
      const component = {
        inputEl,
        setPlaceholder(placeholder: string) {
          inputEl.placeholder = placeholder;
          return component;
        },
        // Like Obsidian's TextComponent, setValue does NOT fire onChange
        setValue(value: string) {
          inputEl.value = value;
          return component;
        },
        onChange(handler: (value: string) => any) {
          inputEl.addEventListener('input', () => handler(inputEl.value));
          return component;
        },
      };
      cb(component);
    }
    return this;
  }

  addDropdown(cb: (dropdown: any) => any): this {
    if (this.hasDom) {
      const selectEl = this.controlEl.createEl('select') as HTMLSelectElement;
      const component = {
        selectEl,
        addOption(value: string, display: string) {
          const option = document.createElement('option');
          option.value = value;
          option.text = display;
          selectEl.appendChild(option);
          return component;
        },
        setValue(value: string) {
          selectEl.value = value;
          return component;
        },
        setDisabled(disabled: boolean) {
          selectEl.disabled = disabled;
          return component;
        },
        onChange(handler: (value: string) => any) {
          selectEl.addEventListener('change', () => handler(selectEl.value));
          return component;
        },
      };
      cb(component);
    }
    return this;
  }

  addToggle(cb: (toggle: any) => any): this {
    if (this.hasDom) {
      const inputEl = this.controlEl.createEl('input') as HTMLInputElement;
      inputEl.type = 'checkbox';
      const component = {
        inputEl,
        setValue(value: boolean) {
          inputEl.checked = value;
          return component;
        },
        // Present because the real ToggleComponent has it and the settings
        // section calls it — a toggle with no label of its own needs one.
        setTooltip(tooltip: string) {
          inputEl.setAttribute('aria-label', tooltip);
          return component;
        },
        onChange(handler: (value: boolean) => any) {
          inputEl.addEventListener('change', () => handler(inputEl.checked));
          return component;
        },
      };
      cb(component);
    }
    return this;
  }

  addExtraButton(cb: (button: any) => any): this {
    if (this.hasDom) {
      // A div, not a button: that is what ExtraButtonComponent creates, and a
      // test that looked for `button` would pass here and find nothing in a
      // real vault.
      const extraSettingsEl = this.controlEl.createDiv({
        cls: 'clickable-icon extra-setting-button',
        attr: { tabIndex: 0 },
      }) as HTMLElement;
      const component = {
        extraSettingsEl,
        setIcon(icon: string) {
          extraSettingsEl.setAttribute('data-icon', icon);
          return component;
        },
        setTooltip(tooltip: string) {
          extraSettingsEl.setAttribute('aria-label', tooltip);
          return component;
        },
        onClick(handler: () => any) {
          extraSettingsEl.addEventListener('click', () => handler());
          return component;
        },
      };
      cb(component);
    }
    return this;
  }

  addButton(cb: (button: any) => any): this {
    if (this.hasDom) {
      const buttonEl = this.controlEl.createEl('button') as HTMLButtonElement;
      const component = {
        buttonEl,
        setButtonText(text: string) {
          buttonEl.textContent = text;
          return component;
        },
        onClick(handler: () => any) {
          buttonEl.addEventListener('click', () => handler());
          return component;
        },
      };
      cb(component);
    }
    return this;
  }
}

export class App {
  vault: any = {};
  workspace: any = {};
}

// TFile mock for instanceof checks
export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;

  constructor(path: string) {
    this.path = path;
    const parts = path.split('/');
    this.name = parts[parts.length - 1];
    const nameParts = this.name.split('.');
    this.extension = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    this.basename = nameParts.slice(0, -1).join('.') || this.name;
  }
}

// Also ensure global availability for instanceof checks
(global as any).TFile = TFile;

// Popout-window globals exposed by Obsidian at runtime.
// Under jsdom they default to the main `document` / `window`.
if (typeof (global as any).activeDocument === 'undefined') {
  Object.defineProperty(global, 'activeDocument', {
    get() {
      return document;
    },
    configurable: true,
  });
}

if (typeof (global as any).activeWindow === 'undefined') {
  Object.defineProperty(global, 'activeWindow', {
    get() {
      return window;
    },
    configurable: true,
  });
}

// Helper to create mock HTMLElement
function createMockElement(): any {
  const element: any = {
    empty: jest.fn().mockReturnThis(),
    createDiv: jest.fn(() => createMockElement()),
    createEl: jest.fn(() => createMockElement()),
    addClass: jest.fn().mockReturnThis(),
    appendChild: jest.fn().mockReturnThis(),
    setText: jest.fn().mockReturnThis(),
    addEventListener: jest.fn(),
    setAttribute: jest.fn(),
    selected: false,
    value: '',
  };
  return element;
}

export class Modal {
  app: any;
  containerEl: any;
  modalEl: any;
  contentEl: any;
  scope: any;

  constructor(app: any) {
    this.app = app;
    // Under jsdom (with obsidian-dom helpers installed) use real elements
    // so render paths can be tested; node-env tests keep the jest.fn mock.
    if (typeof document !== 'undefined') {
      // Same nesting and classes as a real open modal:
      // .modal-container > .modal > .modal-content. A flat mock made
      // `.foo .modal-content` selectors untestable, which is how a modal
      // stylesheet shipped inert.
      this.containerEl = document.createElement('div');
      this.containerEl.className = 'modal-container';
      this.modalEl = document.createElement('div');
      this.modalEl.className = 'modal';
      this.contentEl = document.createElement('div');
      this.contentEl.className = 'modal-content';
      // Attached, as an open modal is. A detached subtree cannot hold the DOM
      // focus, so anything asserting on `document.activeElement` would pass
      // against a modal that never focuses anything.
      this.modalEl.appendChild(this.contentEl);
      this.containerEl.appendChild(this.modalEl);
      document.body.appendChild(this.containerEl);
    } else {
      this.containerEl = createMockElement();
      this.modalEl = createMockElement();
      this.contentEl = createMockElement();
    }
    this.scope = {
      register: jest.fn(),
    };
  }

  /**
   * Every modal opened since the last reset, in order. A command that opens a
   * picker hands it nothing a test can read otherwise: the real `open()` would
   * render, this mock does not, and the constructor arguments are gone by then.
   */
  static opened: Modal[] = [];

  open(): void {
    Modal.opened.push(this);
  }
  close(): void {
    this.containerEl.remove?.();
  }
}

export class Notice {
  /** Every message raised since the last reset — a test reads what the user saw */
  static messages: string[] = [];

  message: string;
  constructor(message?: string) {
    this.message = message ?? '';
    Notice.messages.push(this.message);
  }
  hide(): void {}
}

export abstract class EditorSuggest<T> {
  app: any;
  /**
   * The trigger info of the popup currently open, as Obsidian sets it between
   * onTrigger and selectSuggestion. A test drives the flow by assigning it.
   */
  context: any = null;
  /** Key bindings the suggest registers (ESC and TAB dismissals) */
  scope: { register: jest.Mock } = { register: jest.fn() };
  /**
   * A method on the prototype, never an instance field: a field assigned by
   * this base class would shadow a subclass's own `close()` override, and a
   * test of that override would pass without ever running it.
   */
  close(): void {}
  /** On the prototype too, for the same reason: subclasses call it. */
  setInstructions(_instructions: any[]): void {}

  /**
   * The popup's root element, as Obsidian names it internally. It is absent
   * from the published typings, so the plugin reaches it through a cast — and
   * the mock has to carry it for the chrome to be testable at all.
   */
  suggestEl: HTMLElement =
    typeof document !== 'undefined' ? document.createElement('div') : (null as never);

  constructor(app: any) {
    this.app = app;
  }

  abstract onTrigger(cursor: any, editor: any): any;
  abstract getSuggestions(context: any): T[];
  abstract renderSuggestion(value: T, el: HTMLElement): void;
  abstract selectSuggestion(value: T, evt?: any): void;
}

/**
 * Obsidian's icon helper. The real one injects a lucide SVG; here it only
 * records which icon was asked for, which is what a test can assert on.
 */
export function setIcon(parent: HTMLElement, iconId: string): void {
  parent.setAttribute('data-icon', iconId);
}
