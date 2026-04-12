import { DateTime } from 'luxon';
import { DailyNotesService, DEFAULT_DAILY_NOTES_CONFIG } from '@/services/daily-notes-service';
import { FormatterService } from '@/services/formatter-service';
import { DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { DEFAULT_SETTINGS_BASE } from '@/types/settings';
import type { DateHelpersSettings } from '@/types/settings';
import type { TFile } from 'obsidian';

// Helper to create mock TFile using the globally mocked class
function createMockFile(path: string): TFile {
  const TFileClass = (global as any).TFile;
  return new TFileClass(path);
}

describe('DailyNotesService', () => {
  let mockApp: any; // Use 'any' to allow access to internalPlugins (runtime-only property)
  let formatterService: FormatterService;
  let settings: DateHelpersSettings;
  let service: DailyNotesService;

  beforeEach(() => {
    // Mock Obsidian App with internalPlugins (exists at runtime but not in type definition)
    mockApp = {
      internalPlugins: {
        getPluginById: jest.fn(),
      },
      vault: {
        getAbstractFileByPath: jest.fn(),
        create: jest.fn(),
        createFolder: jest.fn(),
        read: jest.fn(),
      },
    };

    // Create real service instances
    formatterService = new FormatterService('en-US');
    settings = {
      ...DEFAULT_SETTINGS_BASE,
      formatPresets: DEFAULT_FORMAT_PRESETS,
      lastUsedAction: 'insert-daily-note',
      dailyNotesAliasPresetId: 'locale-long',
      dailyNotesAliasFallbackPresetId: 'locale-long',
      dailyNotesCreateIfMissing: false,
    };
    service = new DailyNotesService(mockApp, formatterService, settings);
  });

  describe('getDailyNotesConfig', () => {
    it('should read Daily Notes plugin config when enabled', () => {
      // Mock enabled Daily Notes plugin with config
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '01_Journal',
            template: 'Templates/Daily',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const config = service.getDailyNotesConfig();

      expect(config).toEqual({
        format: 'YYYY-MM-DD',
        folder: '01_Journal',
        template: 'Templates/Daily',
      });
      expect(mockApp.internalPlugins.getPluginById).toHaveBeenCalledWith('daily-notes');
    });

    it('should return defaults if plugin disabled', () => {
      // Mock disabled plugin
      const mockPlugin = {
        enabled: false,
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const config = service.getDailyNotesConfig();

      expect(config).toEqual(DEFAULT_DAILY_NOTES_CONFIG);
    });

    it('should return defaults if plugin not found', () => {
      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(null);

      const config = service.getDailyNotesConfig();

      expect(config).toEqual(DEFAULT_DAILY_NOTES_CONFIG);
    });

    it('should handle missing config fields with defaults', () => {
      // Mock plugin with partial config
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            folder: 'Journal',
            // format and template missing
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const config = service.getDailyNotesConfig();

      expect(config).toEqual({
        format: 'YYYY-MM-DD',
        folder: 'Journal',
        template: '',
      });
    });

    it('should handle missing instance', () => {
      const mockPlugin = {
        enabled: true,
        instance: null,
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const config = service.getDailyNotesConfig();

      expect(config).toEqual(DEFAULT_DAILY_NOTES_CONFIG);
    });

    it('should handle missing options object', () => {
      const mockPlugin = {
        enabled: true,
        instance: {},
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const config = service.getDailyNotesConfig();

      expect(config).toEqual(DEFAULT_DAILY_NOTES_CONFIG);
    });
  });

  describe('getDailyNotePath', () => {
    it('should generate path with folder', () => {
      // Mock config with folder
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '01_Journal',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('01_Journal/2025-11-12');
    });

    it('should handle folder with trailing slash (no double slashes)', () => {
      // Mock config with trailing slash in folder
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '01_Journal/', // Trailing slash
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      // Should not have double slash
      expect(path).toBe('01_Journal/2025-11-12');
      expect(path).not.toContain('//');
    });

    it('should generate path without folder (vault root)', () => {
      // Mock config without folder
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('2025-11-12');
    });

    it('should handle nested folders', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Archive/Journal/2025',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('Archive/Journal/2025/2025-11-12');
    });

    it('should respect custom date format', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY/MM/DD',
            folder: 'Journal',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('Journal/2025/11/12');
    });

    it('should handle format with weekday', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD-ddd',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const path = service.getDailyNotePath(date);

      expect(path).toBe('2025-11-12-Wed');
    });

    it('should trim whitespace from folder', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '  Journal  ',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('Journal/2025-11-12');
    });

    it('should ignore time component in date', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Journal',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12T14:30:00');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('Journal/2025-11-12');
    });
  });

  describe('generateWikilink', () => {
    beforeEach(() => {
      // Mock Daily Notes config
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '01_Journal',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      // Set default alias preset
      settings.dailyNotesAliasPresetId = 'locale-long';
    });

    it('should create wikilink with alias', () => {
      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const wikilink = service.generateWikilink(date);

      expect(wikilink).toMatch(/^\[\[01_Journal\/2025-11-12\|.+\]\]$/);
    });

    it('should use specified alias preset', () => {
      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const wikilink = service.generateWikilink(date, { presetId: 'iso8601' });

      expect(wikilink).toBe('[[01_Journal/2025-11-12|2025-11-12]]');
    });

    it('should fallback to configured preset if not specified', () => {
      settings.dailyNotesAliasPresetId = 'iso8601';

      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const wikilink = service.generateWikilink(date);

      expect(wikilink).toBe('[[01_Journal/2025-11-12|2025-11-12]]');
    });

    it('should use custom alias when provided', () => {
      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const wikilink = service.generateWikilink(date, { customAlias: 'next Friday' });

      expect(wikilink).toBe('[[01_Journal/2025-11-12|next Friday]]');
    });

    it('should use custom alias with special characters', () => {
      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const wikilink = service.generateWikilink(date, { customAlias: 'mercredi prochain' });

      expect(wikilink).toBe('[[01_Journal/2025-11-12|mercredi prochain]]');
    });

    it('should use fallback preset when original-text is configured but no custom alias', () => {
      settings.dailyNotesAliasPresetId = 'original-text';
      settings.dailyNotesAliasFallbackPresetId = 'iso8601';

      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const wikilink = service.generateWikilink(date);

      // Should use fallback preset (iso8601) when no customAlias provided
      expect(wikilink).toBe('[[01_Journal/2025-11-12|2025-11-12]]');
    });

    it('should prefer custom alias over preset when both provided', () => {
      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const wikilink = service.generateWikilink(date, {
        customAlias: 'my custom text',
        presetId: 'iso8601',
      });

      // customAlias takes precedence over presetId
      expect(wikilink).toBe('[[01_Journal/2025-11-12|my custom text]]');
    });

    it('should include time in alias when date has time', () => {
      settings.dailyNotesAliasPresetId = 'datetime-standard';

      const date = DateTime.fromISO('2025-11-12T14:30', { locale: 'en' });
      const wikilink = service.generateWikilink(date);

      // Path should be date-only, alias should include time
      expect(wikilink).toMatch(/^\[\[01_Journal\/2025-11-12\|.+14:30.+\]\]$/);
    });

    it('should handle special characters in path', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'My Notes/Journal (2025)',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const wikilink = service.generateWikilink(date);

      expect(wikilink).toMatch(/^\[\[My Notes\/Journal \(2025\)\/2025-11-12\|.+\]\]$/);
    });

    it('should work with vault root (no folder)', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      settings.dailyNotesAliasPresetId = 'iso8601';

      const date = DateTime.fromISO('2025-11-12');
      const wikilink = service.generateWikilink(date);

      expect(wikilink).toBe('[[2025-11-12|2025-11-12]]');
    });
  });

  describe('dailyNoteExists', () => {
    beforeEach(() => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Journal',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);
    });

    it('should return true if note exists', () => {
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue({});

      const date = DateTime.fromISO('2025-11-12');
      const exists = service.dailyNoteExists(date);

      expect(exists).toBe(true);
      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith('Journal/2025-11-12.md');
    });

    it('should return false if note missing', () => {
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const date = DateTime.fromISO('2025-11-12');
      const exists = service.dailyNoteExists(date);

      expect(exists).toBe(false);
    });

    it('should check correct path with custom format', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY/MM-DD',
            folder: 'Notes',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const date = DateTime.fromISO('2025-11-12');
      service.dailyNoteExists(date);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith('Notes/2025/11-12.md');
    });
  });

  describe('createDailyNote', () => {
    beforeEach(() => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Journal',
            template: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);
    });

    it('should create note without template', async () => {
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      const mockFile = {} as TFile;
      (mockApp.vault.create as jest.Mock).mockResolvedValue(mockFile);

      const date = DateTime.fromISO('2025-11-12');
      const file = await service.createDailyNote(date);

      expect(file).toBe(mockFile);
      expect(mockApp.vault.create).toHaveBeenCalledWith('Journal/2025-11-12.md', '');
    });

    it('should create note with template content', async () => {
      // Mock config with template
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Journal',
            template: 'Templates/Daily',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      // Mock template file exists - needs to be a proper TFile mock
      const templateContent = '# {{date}}\n\n## Notes\n';
      const mockTemplateFile = { path: 'Templates/Daily.md' };

      // First call for note existence check (doesn't exist),
      // Second call for template file (exists)
      (mockApp.vault.getAbstractFileByPath as jest.Mock)
        .mockReturnValueOnce(null) // Note doesn't exist
        .mockReturnValueOnce(mockTemplateFile); // Template exists

      (mockApp.vault.read as jest.Mock).mockResolvedValue(templateContent);

      const mockFile = {} as TFile;
      (mockApp.vault.create as jest.Mock).mockResolvedValue(mockFile);

      const date = DateTime.fromISO('2025-11-12');
      const file = await service.createDailyNote(date);

      expect(mockApp.vault.read).toHaveBeenCalledWith(mockTemplateFile);
      expect(mockApp.vault.create).toHaveBeenCalledWith('Journal/2025-11-12.md', templateContent);
      expect(file).toBe(mockFile);
    });

    it('should create missing folders', async () => {
      // Mock nested folder structure
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Archive/Journal/2025',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      (mockApp.vault.createFolder as jest.Mock).mockResolvedValue(undefined);

      const mockFile = {} as TFile;
      (mockApp.vault.create as jest.Mock).mockResolvedValue(mockFile);

      const date = DateTime.fromISO('2025-11-12');
      await service.createDailyNote(date);

      // Should create folders recursively
      expect(mockApp.vault.createFolder).toHaveBeenCalledWith('Archive');
      expect(mockApp.vault.createFolder).toHaveBeenCalledWith('Archive/Journal');
      expect(mockApp.vault.createFolder).toHaveBeenCalledWith('Archive/Journal/2025');
    });

    it('should not recreate existing note', async () => {
      const mockFile = {} as TFile;
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      const date = DateTime.fromISO('2025-11-12');
      const file = await service.createDailyNote(date);

      expect(file).toBe(mockFile);
      expect(mockApp.vault.create).not.toHaveBeenCalled();
    });

    it('should handle template file not found', async () => {
      // Mock config with template
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Journal',
            template: 'Templates/NonExistent',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      (mockApp.vault.getAbstractFileByPath as jest.Mock)
        .mockReturnValueOnce(null) // Note doesn't exist
        .mockReturnValueOnce(null); // Template doesn't exist

      const mockFile = {} as TFile;
      (mockApp.vault.create as jest.Mock).mockResolvedValue(mockFile);

      const date = DateTime.fromISO('2025-11-12');
      const file = await service.createDailyNote(date);

      // Should create with empty content
      expect(mockApp.vault.create).toHaveBeenCalledWith('Journal/2025-11-12.md', '');
      expect(file).toBe(mockFile);
    });

    it('should return null on creation error', async () => {
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      (mockApp.vault.create as jest.Mock).mockRejectedValue(new Error('Disk full'));

      const date = DateTime.fromISO('2025-11-12');
      const file = await service.createDailyNote(date);

      expect(file).toBeNull();
    });

    it('should handle vault root (no folder)', async () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      const mockFile = {} as TFile;
      (mockApp.vault.create as jest.Mock).mockResolvedValue(mockFile);

      const date = DateTime.fromISO('2025-11-12');
      const file = await service.createDailyNote(date);

      expect(mockApp.vault.createFolder).not.toHaveBeenCalled();
      expect(mockApp.vault.create).toHaveBeenCalledWith('2025-11-12.md', '');
      expect(file).toBe(mockFile);
    });
  });

  describe('convertToLuxonFormat', () => {
    it('should convert YYYY-MM-DD', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('2025-11-12');
    });

    it('should convert YYYY/MM/DD', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY/MM/DD',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('2025/11/12');
    });

    it('should convert short weekday (ddd)', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'ddd YYYY-MM-DD',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const path = service.getDailyNotePath(date);

      expect(path).toBe('Wed 2025-11-12');
    });

    it('should convert long weekday (dddd)', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'dddd, MMMM DD, YYYY',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const path = service.getDailyNotePath(date);

      expect(path).toBe('Wednesday, November 12, 2025');
    });

    it('should convert month names (MMM and MMMM)', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'DD MMM YYYY',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12', { locale: 'en' });
      const path = service.getDailyNotePath(date);

      expect(path).toBe('12 Nov 2025');
    });

    it('should convert time components', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD HH:mm:ss',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12T14:30:45');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('2025-11-12 14:30:45');
    });

    it('should handle single-digit format (M, D)', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-M-D',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-01-05');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('2025-1-5');
    });

    it('should handle 2-digit year (YY)', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YY-MM-DD',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('25-11-12');
    });

    it('should handle 12-hour time with AM/PM', () => {
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD hh:mm A',
            folder: '',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12T14:30');
      const path = service.getDailyNotePath(date);

      expect(path).toBe('2025-11-12 02:30 PM');
    });
  });

  describe('updateSettings', () => {
    it('should update settings reference', () => {
      const newSettings = {
        ...settings,
        dailyNotesAliasPresetId: 'datetime-standard',
      };

      service.updateSettings(newSettings);

      // Test that new settings are used
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Journal',
          },
        },
      };

      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

      const date = DateTime.fromISO('2025-11-12T14:30');
      const wikilink = service.generateWikilink(date);

      // Should use new preset (datetime-standard includes time as 14:30)
      expect(wikilink).toMatch(/2025-11-12.+14:30/);
    });
  });

  describe('openDailyNote (Phase 7.2)', () => {
    beforeEach(() => {
      // Add workspace mock for openDailyNote tests
      mockApp.workspace = {
        openLinkText: jest.fn().mockResolvedValue(undefined),
      };

      // Setup default Daily Notes config
      const mockPlugin = {
        enabled: true,
        instance: {
          options: {
            format: 'YYYY-MM-DD',
            folder: 'Journal',
            template: '',
          },
        },
      };
      (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);
    });

    describe('Note exists', () => {
      it('should open existing note without creating', async () => {
        const date = DateTime.fromISO('2025-11-12');
        const mockFile = createMockFile('Journal/2025-11-12.md');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

        await service.openDailyNote(date);

        expect(mockApp.workspace.openLinkText).toHaveBeenCalledWith('', 'Journal/2025-11-12.md', false);
        expect(mockApp.vault.create).not.toHaveBeenCalled();
      });

      it('should work regardless of dailyNotesCreateIfMissing setting', async () => {
        const date = DateTime.fromISO('2025-11-12');
        const mockFile = createMockFile('Journal/2025-11-12.md');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

        // Test with auto-create OFF
        service.updateSettings({ ...settings, dailyNotesCreateIfMissing: false });
        await service.openDailyNote(date);
        expect(mockApp.workspace.openLinkText).toHaveBeenCalledTimes(1);

        // Test with auto-create ON
        service.updateSettings({ ...settings, dailyNotesCreateIfMissing: true });
        await service.openDailyNote(date);
        expect(mockApp.workspace.openLinkText).toHaveBeenCalledTimes(2);
      });

      it('should handle notes in vault root (no folder)', async () => {
        const mockPlugin = {
          enabled: true,
          instance: {
            options: {
              format: 'YYYY-MM-DD',
              folder: '',
            },
          },
        };
        (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

        const date = DateTime.fromISO('2025-11-12');
        const mockFile = createMockFile('2025-11-12.md');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

        await service.openDailyNote(date);

        expect(mockApp.workspace.openLinkText).toHaveBeenCalledWith('', '2025-11-12.md', false);
      });
    });

    describe('Note missing + auto-create ON', () => {
      beforeEach(() => {
        service.updateSettings({ ...settings, dailyNotesCreateIfMissing: true });
      });

      it('should create and open note when missing', async () => {
        const date = DateTime.fromISO('2025-11-12');
        const mockFile = createMockFile('Journal/2025-11-12.md');

        // First check: note doesn't exist
        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
        // createDailyNote will succeed
        (mockApp.vault.create as jest.Mock).mockResolvedValue(mockFile);

        await service.openDailyNote(date);

        // Should create note
        expect(mockApp.vault.create).toHaveBeenCalledWith(
          'Journal/2025-11-12.md',
          ''
        );

        // Should open the newly created note
        expect(mockApp.workspace.openLinkText).toHaveBeenCalledWith('', 'Journal/2025-11-12.md', false);
      });

      it('should throw error if creation fails', async () => {
        const date = DateTime.fromISO('2025-11-12');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
        (mockApp.vault.create as jest.Mock).mockRejectedValue(new Error('Disk full'));

        await expect(service.openDailyNote(date)).rejects.toThrow('Failed to create daily note');

        // Should not attempt to open
        expect(mockApp.workspace.openLinkText).not.toHaveBeenCalled();
      });

      it('should create folder structure if needed', async () => {
        const date = DateTime.fromISO('2025-11-12');
        const mockFile = createMockFile('Journal/2025-11-12.md');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
        // Simulate folder creation
        (mockApp.vault.createFolder as jest.Mock).mockResolvedValue(undefined);
        (mockApp.vault.create as jest.Mock).mockResolvedValue(mockFile);

        await service.openDailyNote(date);

        // Should create note (folder creation is handled by createDailyNote)
        expect(mockApp.vault.create).toHaveBeenCalled();
        expect(mockApp.workspace.openLinkText).toHaveBeenCalledWith('', 'Journal/2025-11-12.md', false);
      });
    });

    describe('Note missing + auto-create OFF', () => {
      beforeEach(() => {
        service.updateSettings({ ...settings, dailyNotesCreateIfMissing: false });
      });

      it('should throw error when note missing', async () => {
        const date = DateTime.fromISO('2025-11-12');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

        await expect(service.openDailyNote(date)).rejects.toThrow(
          'Daily note does not exist: 2025-11-12. Enable "Auto-create" in settings to create automatically.'
        );

        // Should not create or open
        expect(mockApp.vault.create).not.toHaveBeenCalled();
        expect(mockApp.workspace.openLinkText).not.toHaveBeenCalled();
      });

      it('should provide helpful error message with date', async () => {
        const date = DateTime.fromISO('2025-03-05');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

        await expect(service.openDailyNote(date)).rejects.toThrow(
          'Daily note does not exist: 2025-03-05'
        );
      });

      it('should not attempt creation even if folder exists', async () => {
        const date = DateTime.fromISO('2025-11-12');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

        await expect(service.openDailyNote(date)).rejects.toThrow();

        // Should not attempt to create
        expect(mockApp.vault.create).not.toHaveBeenCalled();
        expect(mockApp.vault.createFolder).not.toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle file check returning non-TFile abstract file', async () => {
        const date = DateTime.fromISO('2025-11-12');
        const mockFolder = {
          path: 'Journal/2025-11-12.md',
          // Not a TFile (missing required TFile properties)
        };

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFolder);
        service.updateSettings({ ...settings, dailyNotesCreateIfMissing: false });

        // Should treat non-TFile as "missing" and throw error
        await expect(service.openDailyNote(date)).rejects.toThrow();
      });

      it('should work with different date formats', async () => {
        const mockPlugin = {
          enabled: true,
          instance: {
            options: {
              format: 'YYYY/MM/DD',
              folder: 'Daily',
            },
          },
        };
        (mockApp.internalPlugins.getPluginById as jest.Mock).mockReturnValue(mockPlugin);

        const date = DateTime.fromISO('2025-11-12');
        const mockFile = createMockFile('Daily/2025/11/12.md');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

        await service.openDailyNote(date);

        expect(mockApp.workspace.openLinkText).toHaveBeenCalledWith('', 'Daily/2025/11/12.md', false);
      });

      it('should handle dates with time components (time should be ignored)', async () => {
        const dateWithTime = DateTime.fromISO('2025-11-12T14:30:00');
        const mockFile = createMockFile('Journal/2025-11-12.md');

        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

        await service.openDailyNote(dateWithTime);

        // Should open note based on date only (time ignored)
        expect(mockApp.workspace.openLinkText).toHaveBeenCalledWith('', 'Journal/2025-11-12.md', false);
      });
    });
  });
});
