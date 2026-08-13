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
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl =
      typeof document !== 'undefined' ? document.createElement('div') : createMockElement();
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
        onChange(handler: (value: boolean) => any) {
          inputEl.addEventListener('change', () => handler(inputEl.checked));
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
  contentEl: any;
  scope: any;

  constructor(app: any) {
    this.app = app;
    // Under jsdom (with obsidian-dom helpers installed) use real elements
    // so render paths can be tested; node-env tests keep the jest.fn mock.
    if (typeof document !== 'undefined') {
      this.containerEl = document.createElement('div');
      this.contentEl = document.createElement('div');
    } else {
      this.containerEl = createMockElement();
      this.contentEl = createMockElement();
    }
    this.scope = {
      register: jest.fn(),
    };
  }

  open(): void {}
  close(): void {}
}

export class Notice {
  message: string;
  constructor(message?: string) {
    this.message = message ?? '';
  }
  hide(): void {}
}

export abstract class EditorSuggest<T> {
  app: any;

  constructor(app: any) {
    this.app = app;
  }

  abstract onTrigger(cursor: any, editor: any): any;
  abstract getSuggestions(context: any): T[];
  abstract renderSuggestion(value: T, el: HTMLElement): void;
  abstract selectSuggestion(value: T): void;
}
