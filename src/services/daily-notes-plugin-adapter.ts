import type { App } from 'obsidian';

export interface DailyNotesPluginOptions {
  format?: string;
  folder?: string;
  template?: string;
}

export interface DailyNotesPluginInstance {
  options?: DailyNotesPluginOptions;
}

export interface DailyNotesPluginRef {
  enabled: boolean;
  instance?: DailyNotesPluginInstance;
}

export class DailyNotesPluginAdapter {
  constructor(private readonly app: App) {}

  getRef(): DailyNotesPluginRef | null {
    // @ts-expect-error - app.internalPlugins is intentionally undocumented; this is the single cast in the codebase.
    const host = this.app.internalPlugins as
      | { getPluginById(id: string): DailyNotesPluginRef | null | undefined }
      | undefined;
    return host?.getPluginById('daily-notes') ?? null;
  }
}
