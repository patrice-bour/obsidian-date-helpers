import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
} from 'obsidian';
import DateHelpersPlugin from '@/main';

/**
 * EditorSuggest implementation for trigger character detection
 * Detects configured trigger characters (e.g., "@@") and opens date picker
 */
export class DatePickerSuggest extends EditorSuggest<null> {
  private plugin: DateHelpersPlugin;
  private triggerChars: string[];

  constructor(
    app: App,
    plugin: DateHelpersPlugin,
    triggerChars: string[],
  ) {
    super(app);
    this.plugin = plugin;
    this.triggerChars = triggerChars;
  }

  /**
   * Detect if trigger characters are present at cursor position
   */
  onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
    // Check if date picker is enabled in settings
    if (!this.plugin.settings.enableDatePicker) {
      return null; // Triggers disabled
    }

    const line = editor.getLine(cursor.line);
    const textBefore = line.substring(0, cursor.ch);

    // Check if any trigger character sequence ends exactly at cursor position
    for (const trigger of this.triggerChars) {
      if (textBefore.endsWith(trigger)) {
        const triggerStart = cursor.ch - trigger.length;

        return {
          start: { line: cursor.line, ch: triggerStart },
          end: cursor,
          query: '',
        };
      }
    }

    return null;
  }

  /**
   * Open date picker modal instead of showing suggestions
   * This is called by EditorSuggest when trigger is detected
   * Passes any NLP-parsed date to pre-select in calendar
   */
  getSuggestions(context: EditorSuggestContext): null[] {
    // Open date picker modal
    this.plugin.showDatePickerFromTrigger(
      context.editor,
      context.start,
      context.end,
    );

    return [];
  }

  /**
   * Not used - we open modal instead of showing suggestions
   */
  renderSuggestion(_value: null, _el: HTMLElement): void {
    // Not used
  }

  /**
   * Not used - we open modal instead of showing suggestions
   */
  selectSuggestion(_value: null): void {
    // Not used
  }
}
