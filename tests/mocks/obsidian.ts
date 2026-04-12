/**
 * Mock Obsidian API for testing
 */

export class Plugin {
  app: any;
  manifest: any;

  addCommand(_command: any): void {}
  addSettingTab(_tab: any): void {}
  async loadData(): Promise<any> {
    return {};
  }
  async saveData(_data: any): Promise<void> {}
  registerEvent(_event: any): void {}
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
  hide(): void {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: string): this {
    return this;
  }
  addText(_cb: (text: any) => any): this {
    return this;
  }
  addDropdown(_cb: (dropdown: any) => any): this {
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
    this.containerEl = createMockElement();
    this.contentEl = createMockElement();
    this.scope = {
      register: jest.fn(),
    };
  }

  open(): void {}
  close(): void {}
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
