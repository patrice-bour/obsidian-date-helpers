/**
 * An error whose message is already in the user's language and can be shown
 * as-is.
 *
 * Without this marker, a display site has no way to tell a message it may show
 * from one it may not: `openDailyNote` raises its own translated failures, but
 * it also awaits Obsidian's `openLinkText` and the vault API, whose rejections
 * carry English — or internal — text. Showing `error.message` unconditionally
 * puts that text in front of a French user.
 */
export class TranslatedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslatedError';
  }
}

/** Is this a failure the plugin itself phrased for the user? */
export function isTranslatedError(error: unknown): error is TranslatedError {
  return error instanceof TranslatedError;
}
