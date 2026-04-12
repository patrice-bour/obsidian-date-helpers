import { DatePickerSuggest } from '@/ui/date-picker-suggest';
import DateHelpersPlugin from '@/main';
import { Editor, EditorPosition } from 'obsidian';

describe('DatePickerSuggest', () => {
  let mockApp: any;
  let mockPlugin: any;
  let mockEditor: any;
  let suggest: DatePickerSuggest;

  beforeEach(() => {
    // Mock App
    mockApp = {
      vault: {},
      workspace: {},
    };

    // Mock Plugin with showDatePickerFromTrigger method and settings
    mockPlugin = {
      showDatePickerFromTrigger: jest.fn(),
      settings: {
        enableDatePicker: true, // Enabled by default for tests
      } as any,
    } as any;

    // Mock Editor
    mockEditor = {
      getLine: jest.fn(),
      getCursor: jest.fn(),
      replaceRange: jest.fn(),
    } as Partial<Editor>;

    // Create DatePickerSuggest with default trigger characters
    suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, ['@@']);
  });

  describe('onTrigger', () => {
    it('should trigger when cursor is after trigger characters', () => {
      const cursor: EditorPosition = { line: 0, ch: 2 };
      mockEditor.getLine = jest.fn().mockReturnValue('@@');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.end).toEqual({ line: 0, ch: 2 });
      expect(result?.query).toBe(''); // Query is text AFTER trigger
    });

    it('should trigger when cursor is after trigger characters with text before', () => {
      const cursor: EditorPosition = { line: 0, ch: 12 };
      mockEditor.getLine = jest.fn().mockReturnValue('some text @@');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 10 });
      expect(result?.end).toEqual({ line: 0, ch: 12 });
      expect(result?.query).toBe(''); // Query is text AFTER trigger
    });

    it('should not trigger when trigger characters are not at cursor', () => {
      const cursor: EditorPosition = { line: 0, ch: 15 };
      mockEditor.getLine = jest.fn().mockReturnValue('some @@ text here');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).toBeNull();
    });

    it('should not trigger when cursor is in middle of word', () => {
      const cursor: EditorPosition = { line: 0, ch: 10 };
      mockEditor.getLine = jest.fn().mockReturnValue('some text@@ more');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).toBeNull();
    });

    it('should not trigger when line does not contain trigger characters', () => {
      const cursor: EditorPosition = { line: 0, ch: 10 };
      mockEditor.getLine = jest.fn().mockReturnValue('some text here');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).toBeNull();
    });

    it('should handle multiple trigger character options', () => {
      suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, ['@@', '##']);

      const cursor1: EditorPosition = { line: 0, ch: 2 };
      mockEditor.getLine = jest.fn().mockReturnValue('@@');
      const result1 = suggest.onTrigger(cursor1, mockEditor as Editor);
      expect(result1).not.toBeNull();
      expect(result1?.query).toBe(''); // Query is text AFTER trigger

      const cursor2: EditorPosition = { line: 0, ch: 2 };
      mockEditor.getLine = jest.fn().mockReturnValue('##');
      const result2 = suggest.onTrigger(cursor2, mockEditor as Editor);
      expect(result2).not.toBeNull();
      expect(result2?.query).toBe(''); // Query is text AFTER trigger
    });

    it('should work with longer trigger sequences', () => {
      suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, ['@date']);

      const cursor: EditorPosition = { line: 0, ch: 5 };
      mockEditor.getLine = jest.fn().mockReturnValue('@date');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.end).toEqual({ line: 0, ch: 5 });
      expect(result?.query).toBe(''); // Query is text AFTER trigger
    });

    it('should handle empty trigger characters array', () => {
      suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, []);

      const cursor: EditorPosition = { line: 0, ch: 2 };
      mockEditor.getLine = jest.fn().mockReturnValue('@@');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).toBeNull();
    });

    it('should trigger at cursor position, not after whitespace', () => {
      const cursor: EditorPosition = { line: 0, ch: 2 };
      mockEditor.getLine = jest.fn().mockReturnValue('@@ ');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).not.toBeNull();
      expect(result?.query).toBe(''); // Query is text AFTER trigger
    });

    it('should handle trigger characters at start of line', () => {
      const cursor: EditorPosition = { line: 5, ch: 2 };
      mockEditor.getLine = jest.fn().mockReturnValue('@@');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 5, ch: 0 });
      expect(result?.end).toEqual({ line: 5, ch: 2 });
    });

    it('should not trigger when enableDatePicker is false', () => {
      // Disable date picker in settings
      mockPlugin.settings.enableDatePicker = false;

      const cursor: EditorPosition = { line: 0, ch: 2 };
      mockEditor.getLine = jest.fn().mockReturnValue('@@');

      const result = suggest.onTrigger(cursor, mockEditor as Editor);

      expect(result).toBeNull();
    });
  });

  describe('getSuggestions', () => {
    it('should call plugin showDatePickerFromTrigger with context', () => {
      const context = {
        editor: mockEditor,
        start: { line: 0, ch: 0 },
        end: { line: 0, ch: 2 },
        query: '@@',
      };

      const result = suggest.getSuggestions(context as any);

      expect(mockPlugin.showDatePickerFromTrigger).toHaveBeenCalledWith(
        mockEditor,
        { line: 0, ch: 0 },
        { line: 0, ch: 2 },
      );
      expect(result).toEqual([]); // Returns empty array
    });

    it('should return empty array', () => {
      const context = {
        editor: mockEditor,
        start: { line: 0, ch: 0 },
        end: { line: 0, ch: 2 },
        query: '@@',
      };

      const result = suggest.getSuggestions(context as any);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('renderSuggestion', () => {
    it('should not throw when called', () => {
      const mockEl = {} as HTMLElement;
      expect(() => {
        suggest.renderSuggestion(null, mockEl);
      }).not.toThrow();
    });
  });

  describe('selectSuggestion', () => {
    it('should not throw when called', () => {
      expect(() => {
        suggest.selectSuggestion(null);
      }).not.toThrow();
    });
  });
});
