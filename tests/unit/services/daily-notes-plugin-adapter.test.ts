import type { App } from 'obsidian';
import { DailyNotesPluginAdapter } from '@/services/daily-notes-plugin-adapter';

interface MockApp {
  internalPlugins?: {
    getPluginById: jest.Mock;
  };
}

function makeApp(overrides: MockApp = {}): App {
  return overrides as unknown as App;
}

describe('DailyNotesPluginAdapter', () => {
  it('returns null when the internal plugin is missing', () => {
    const app = makeApp({
      internalPlugins: { getPluginById: jest.fn().mockReturnValue(null) },
    });

    const adapter = new DailyNotesPluginAdapter(app);
    expect(adapter.getRef()).toBeNull();
  });

  it('returns null when getPluginById returns undefined', () => {
    const app = makeApp({
      internalPlugins: { getPluginById: jest.fn().mockReturnValue(undefined) },
    });

    expect(new DailyNotesPluginAdapter(app).getRef()).toBeNull();
  });

  it('returns null when internalPlugins host is absent', () => {
    const adapter = new DailyNotesPluginAdapter(makeApp());
    expect(adapter.getRef()).toBeNull();
  });

  it('returns the plugin ref when enabled with full options', () => {
    const ref = {
      enabled: true,
      instance: {
        options: { format: 'YYYY-MM-DD', folder: 'journal', template: 'tpl/daily' },
      },
    };
    const getPluginById = jest.fn().mockReturnValue(ref);
    const app = makeApp({ internalPlugins: { getPluginById } });

    const adapter = new DailyNotesPluginAdapter(app);
    const result = adapter.getRef();

    expect(result).toBe(ref);
    expect(getPluginById).toHaveBeenCalledWith('daily-notes');
  });

  it('returns the plugin ref with partial options', () => {
    const ref = { enabled: true, instance: { options: { format: 'DD-MM-YYYY' } } };
    const app = makeApp({
      internalPlugins: { getPluginById: jest.fn().mockReturnValue(ref) },
    });

    expect(new DailyNotesPluginAdapter(app).getRef()).toBe(ref);
  });

  it('returns the plugin ref when disabled', () => {
    const ref = { enabled: false };
    const app = makeApp({
      internalPlugins: { getPluginById: jest.fn().mockReturnValue(ref) },
    });

    expect(new DailyNotesPluginAdapter(app).getRef()).toBe(ref);
  });
});
