/**
 * How long an alias may be inside a selector option label.
 *
 * The three outputs of the daily note action differ by their alias alone, so
 * the label must show enough of it to tell them apart, and little enough that
 * the dropdown stays one line wide.
 */
const ALIAS_LABEL_MAX = 18;

/**
 * Shorten an output for use as a format selector label.
 *
 * A wikilink keeps its brackets and its path: they are what says "this writes
 * a link", and dropping them would make the option unreadable. Only the alias
 * is shortened — it is the part that differs between the options.
 *
 * Anything that is not a wikilink is returned as it stands: a formatted date
 * is already short, and the open-daily-note line is a sentence, not a link.
 */
export function shortenOutputLabel(output: string): string {
  const match = /^(\[\[[^|]*\|)(.*)(\]\])$/.exec(output);
  if (!match) return output;

  const [, head, alias, tail] = match;
  if (Array.from(alias).length <= ALIAS_LABEL_MAX) return output;

  return `${head}${shortenAlias(alias)}${tail}`;
}

/**
 * Cut at the limit, then walk back to the last space or comma — a half-written
 * word is not a worked example. A single long word has no boundary to walk
 * back to, and is cut where it stands rather than vanishing.
 */
function shortenAlias(alias: string): string {
  // Code points, not UTF-16 units: an emoji straddling the limit would be cut
  // in half and the label would carry a lone surrogate, drawn as `\ufffd`.
  const points = Array.from(alias);
  const cut = points.slice(0, ALIAS_LABEL_MAX).join('');
  // The character the cut fell on: a space there means the cut already landed
  // on a boundary, and walking back would drop a whole word for nothing.
  const landedOnBoundary = /\s/.test(points[ALIAS_LABEL_MAX] ?? '');
  const boundary = landedOnBoundary
    ? cut.length
    : Math.max(cut.lastIndexOf(' '), cut.lastIndexOf(','));
  const kept = boundary > 0 ? cut.slice(0, boundary) : cut;
  return `${kept.replace(/[\s,]+$/, '')}…`;
}
