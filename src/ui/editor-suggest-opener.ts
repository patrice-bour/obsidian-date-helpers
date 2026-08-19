import { App, Editor, TFile } from 'obsidian';

/**
 * Obsidian's editor-suggest manager, which the public typings do not declare.
 *
 * A suggest is handed over with `registerEditorSuggest`, and from then on
 * Obsidian alone decides when to ask it anything. That decision follows the
 * user's own keystrokes: a write made by plugin code goes unnoticed, so the
 * popup that should stand under a trigger we wrote ourselves never opens.
 *
 * `trigger(editor, file, manual)` is the way in, and `manual` is what makes the
 * list appear under a bare trigger instead of waiting for something to be
 * typed. `obsidian` 1.13.1 declares `registerEditorSuggest` and nothing else,
 * so this shape is asserted here, in one place, and no call site ever casts.
 */
interface EditorSuggestManager {
  trigger(editor: Editor, file: TFile | null, manual: boolean): void;
}

function isManager(candidate: unknown): candidate is EditorSuggestManager {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof (candidate as { trigger?: unknown }).trigger === 'function'
  );
}

/**
 * Ask Obsidian to open its suggestion popup for `editor`, and report whether it
 * could be asked at all.
 *
 * A version of Obsidian that renames or removes this leaves the trigger sitting
 * inert in the note. That is the whole reason the selected text is kept in
 * place rather than held aside: the worst this failure can do is show a
 * character the user has to erase, never lose what they had selected.
 */
export function openEditorSuggest(app: App, editor: Editor, file: TFile | null): boolean {
  const manager = (app as { workspace?: { editorSuggest?: unknown } }).workspace?.editorSuggest;
  if (!isManager(manager)) return false;

  try {
    manager.trigger(editor, file, true);
    return true;
  } catch {
    // Obsidian's own implementation gives up when the editor has lost focus.
    // The keydown listener still has a document to leave in a sane state.
    return false;
  }
}
