import { App, TFile } from 'obsidian';
import { DateTime } from 'luxon';
import type { FormatterService } from './formatter-service';
import type { DateHelpersSettings } from '../types/settings';

/**
 * Daily Notes configuration from Obsidian
 */
export interface DailyNotesConfig {
  format: string;   // Date format (Moment.js style)
  folder: string;   // Folder path (empty = vault root)
  template: string; // Template file path (without .md)
}

/**
 * Default Daily Notes configuration
 */
export const DEFAULT_DAILY_NOTES_CONFIG: DailyNotesConfig = {
  format: 'YYYY-MM-DD',
  folder: '',
  template: '',
};

/**
 * Daily Notes integration service
 *
 * Handles wikilink generation, note creation, and config reading.
 * Bridges date parsing/selection with Obsidian's Daily Notes system.
 */
export class DailyNotesService {
  private app: App;
  private formatterService: FormatterService;
  private settings: DateHelpersSettings;

  constructor(
    app: App,
    formatterService: FormatterService,
    settings: DateHelpersSettings
  ) {
    this.app = app;
    this.formatterService = formatterService;
    this.settings = settings;
  }

  /**
   * Get Daily Notes configuration from Obsidian
   *
   * Reads config from the core Daily Notes plugin.
   * Falls back to defaults if plugin not enabled.
   *
   * @returns Daily Notes configuration
   */
  getDailyNotesConfig(): DailyNotesConfig {
    // @ts-expect-error - Access internal Daily Notes plugin (not in public API)
    const dailyNotesPlugin = this.app.internalPlugins.getPluginById('daily-notes');

    if (!dailyNotesPlugin || !dailyNotesPlugin.enabled) {
      return DEFAULT_DAILY_NOTES_CONFIG;
    }

    const config = dailyNotesPlugin.instance?.options || {};

    return {
      format: config.format || 'YYYY-MM-DD',
      folder: config.folder || '',
      template: config.template || '',
    };
  }

  /**
   * Generate the file path for a daily note
   *
   * Uses Daily Notes configuration to determine the correct path.
   * Does NOT include .md extension.
   *
   * @param date - Target date (time component ignored for path)
   * @returns Path like "01_Journal/2025-11-12" or "2025-11-12"
   *
   * @example
   * // With folder "01_Journal/" and format "YYYY-MM-DD"
   * getDailyNotePath(DateTime.fromISO('2025-11-12'))
   * // Returns: "01_Journal/2025-11-12"
   *
   * @example
   * // With no folder and format "YYYY-MM-DD"
   * getDailyNotePath(DateTime.fromISO('2025-11-12'))
   * // Returns: "2025-11-12"
   */
  getDailyNotePath(date: DateTime): string {
    const config = this.getDailyNotesConfig();

    // Format the date according to Daily Notes config
    const filename = date.toFormat(this.convertToLuxonFormat(config.format));

    // Combine folder + filename
    // Remove trailing slash from folder to avoid double slashes
    const folder = config.folder.trim().replace(/\/+$/, '');
    const path = folder ? `${folder}/${filename}` : filename;

    return path;
  }

  /**
   * Generate a wikilink with alias
   *
   * Creates formatted wikilink: [[path|alias]]
   * - Path: Always date-only (Daily Note path)
   * - Alias: Custom text, or formatted according to preset (may include time)
   *
   * @param date - Target date (may include time for alias)
   * @param options - Optional configuration
   * @param options.customAlias - Custom text to use as alias (e.g., original selected text)
   * @param options.presetId - Preset ID for alias formatting (ignored if customAlias provided)
   * @returns Wikilink like "[[01_Journal/2025-11-12|12 novembre 2025]]"
   *
   * @example
   * // Date without time
   * generateWikilink(DateTime.fromISO('2025-11-12'))
   * // Returns: "[[01_Journal/2025-11-12|12 novembre 2025]]"
   *
   * @example
   * // Date with time - time appears in alias for context
   * generateWikilink(DateTime.fromISO('2025-11-12T14:00'))
   * // Returns: "[[01_Journal/2025-11-12|12 novembre 2025 à 14:00]]"
   *
   * @example
   * // With custom alias (original text)
   * generateWikilink(DateTime.fromISO('2025-11-12'), { customAlias: 'next Friday' })
   * // Returns: "[[01_Journal/2025-11-12|next Friday]]"
   */
  generateWikilink(date: DateTime, options?: { customAlias?: string; presetId?: string }): string {
    const path = this.getDailyNotePath(date);

    // If custom alias is provided, use it directly
    if (options?.customAlias) {
      return `[[${path}|${options.customAlias}]]`;
    }

    // Use specified preset or fallback to configured alias preset
    const presetId = options?.presetId || this.settings.dailyNotesAliasPresetId;

    // Handle 'original-text' preset when no custom alias - use fallback
    const effectivePresetId = presetId === 'original-text'
      ? this.settings.dailyNotesAliasFallbackPresetId
      : presetId;

    // Look up the preset from settings
    const preset = this.settings.formatPresets.find(p => p.id === effectivePresetId);
    if (!preset) {
      // Fallback to ISO format if preset not found
      console.warn(`Preset not found: ${effectivePresetId}, using fallback`);
      const alias = this.formatterService.format(date, 'yyyy-MM-dd HH:mm');
      return `[[${path}|${alias}]]`;
    }

    // FormatterService handles datetime formatting
    // If date has time component, preset will include it in output
    const alias = this.formatterService.format(date, preset.format);

    return `[[${path}|${alias}]]`;
  }

  /**
   * Check if a daily note exists
   *
   * @param date - Target date
   * @returns true if note file exists in vault
   */
  dailyNoteExists(date: DateTime): boolean {
    const path = this.getDailyNotePath(date);
    const file = this.app.vault.getAbstractFileByPath(`${path}.md`);
    return file !== null;
  }

  /**
   * Create a daily note with optional template
   *
   * Creates the note file with configured template content.
   * Automatically creates missing parent folders.
   *
   * @param date - Target date
   * @returns Created TFile or null if failed
   *
   * @remarks
   * - Template content is copied as-is (no variable processing)
   * - Daily Notes plugin or Templater handles variable substitution
   * - Folders are created recursively if needed
   * - If note already exists, returns existing file
   */
  async createDailyNote(date: DateTime): Promise<TFile | null> {
    const path = this.getDailyNotePath(date);
    const fullPath = `${path}.md`;

    // Check if already exists
    if (this.dailyNoteExists(date)) {
      return this.app.vault.getAbstractFileByPath(fullPath) as TFile;
    }

    try {
      // Get template content
      const config = this.getDailyNotesConfig();
      let content = '';

      if (config.template) {
        const templateFile = this.app.vault.getAbstractFileByPath(`${config.template}.md`);
        // Check if templateFile exists, is a file (has 'path'), and ends with .md
        // We don't use instanceof TFile to avoid test mocking issues
        // We check extension to ensure it's not a folder (folders can have 'path' too)
        if (templateFile && 'path' in templateFile && templateFile.path.endsWith('.md')) {
          // Copy template as-is, NO variable processing
          // Daily Notes plugin or Templater handles variable substitution
          content = await this.app.vault.read(templateFile as TFile);
        }
      }

      // Ensure folder exists
      const folder = path.substring(0, path.lastIndexOf('/'));
      if (folder) {
        await this.ensureFolderExists(folder);
      }

      // Create file
      const file = await this.app.vault.create(fullPath, content);
      return file;
    } catch (error) {
      console.error('Failed to create daily note:', error);
      return null;
    }
  }

  /**
   * Ensure a folder path exists, creating if necessary
   *
   * Creates all parent folders recursively.
   *
   * @param folderPath - Folder path to ensure (e.g., "01_Journal/2025")
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const parts = folderPath.split('/');
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const folder = this.app.vault.getAbstractFileByPath(currentPath);

      if (!folder) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  /**
   * Convert Daily Notes format (Moment.js) to Luxon format
   *
   * Daily Notes plugin uses Moment.js format strings.
   * We need to convert them to Luxon format for DateTime.toFormat().
   *
   * @param momentFormat - Moment.js format string (e.g., "YYYY-MM-DD")
   * @returns Luxon format string (e.g., "yyyy-MM-dd")
   *
   * @remarks
   * Common conversions:
   * - YYYY → yyyy (4-digit year)
   * - MM → MM (2-digit month)
   * - DD → dd (2-digit day)
   * - ddd → ccc (short weekday)
   * - dddd → cccc (long weekday)
   * - MMM → LLL (short month)
   * - MMMM → LLLL (long month)
   * - HH → HH (24-hour)
   * - mm → mm (minutes)
   * - ss → ss (seconds)
   */
  private convertToLuxonFormat(momentFormat: string): string {
    // Common conversions (extend as needed)
    const conversions: Record<string, string> = {
      'YYYY': 'yyyy',
      'YY': 'yy',
      'MMMM': 'LLLL',
      'MMM': 'LLL',
      'MM': 'MM',
      'M': 'M',
      'dddd': 'cccc',
      'ddd': 'ccc',
      'DD': 'dd',
      'D': 'd',
      'HH': 'HH',
      'H': 'H',
      'hh': 'hh',
      'h': 'h',
      'mm': 'mm',
      'm': 'm',
      'ss': 'ss',
      's': 's',
      'A': 'a',
      'a': 'a',
    };

    // Sort by length (descending) to replace longer patterns first
    const sortedKeys = Object.keys(conversions).sort((a, b) => b.length - a.length);

    let luxonFormat = momentFormat;
    for (const moment of sortedKeys) {
      const luxon = conversions[moment];
      luxonFormat = luxonFormat.replace(new RegExp(moment, 'g'), luxon);
    }

    return luxonFormat;
  }

  /**
   * Open (or create) daily note for given date
   *
   * Phase 7.2: New feature for "Open Daily Note" action.
   * Navigates to the daily note in the workspace without inserting text.
   *
   * @param date - Date of the daily note to open
   * @returns Promise that resolves when note is opened
   *
   * @remarks
   * - If note exists, opens it in the active leaf
   * - If note doesn't exist and dailyNotesCreateIfMissing is true, creates then opens
   * - If note doesn't exist and setting is false, shows error notice
   */
  async openDailyNote(date: DateTime): Promise<void> {
    // Get daily note file path
    const filePath = this.getDailyNotePath(date);

    // Check if note exists
    const file = this.app.vault.getAbstractFileByPath(`${filePath}.md`);

    if (file && file instanceof TFile) {
      // Note exists - open it
      await this.app.workspace.openLinkText('', file.path, false);
      return;
    }

    // Note doesn't exist
    if (this.settings.dailyNotesCreateIfMissing) {
      // Create and open
      const newFile = await this.createDailyNote(date);
      if (newFile) {
        await this.app.workspace.openLinkText('', newFile.path, false);
      } else {
        // Creation failed - error already logged in createDailyNote
        throw new Error('Failed to create daily note');
      }
    } else {
      // Don't auto-create - show error
      const formattedDate = date.toFormat('yyyy-MM-dd');
      throw new Error(`Daily note does not exist: ${formattedDate}. Enable "Auto-create" in settings to create automatically.`);
    }
  }

  /**
   * Update settings reference
   *
   * Called when settings are saved to keep service in sync.
   *
   * @param settings - New settings
   */
  updateSettings(settings: DateHelpersSettings): void {
    this.settings = settings;
  }
}
