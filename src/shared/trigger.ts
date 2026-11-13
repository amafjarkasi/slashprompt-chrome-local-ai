export interface TriggerMatch {
  /** Start index of the trigger prefix (e.g. `//`) */
  start: number;
  /** End index of the matched prompt (cursor position) */
  end: number;
  /** Raw text after the trigger prefix (trimmed) */
  query: string;
}

/**
 * Finds an active trigger command (e.g. `// write a poem`) ending at `cursorOffset`.
 * Ignores URLs (`https://...`) and triple slashes (`///`).
 */
export function findTriggerMatch(
  text: string,
  cursorOffset: number,
  prefix: string = '//'
): TriggerMatch | null {
  if (!prefix || cursorOffset <= prefix.length || cursorOffset > text.length) {
    return null;
  }

  const beforeCursor = text.slice(0, cursorOffset);
  const idx = beforeCursor.lastIndexOf(prefix);
  if (idx === -1) {
    return null;
  }

  // Must be at start of text or preceded by whitespace (never `:` as in `https://` or another `/`)
  if (idx > 0) {
    const prevChar = beforeCursor[idx - 1];
    if (!/\s/.test(prevChar)) {
      return null;
    }
  }

  const afterPrefix = beforeCursor.slice(idx + prefix.length);

  // Ignore triple-slash comments like `///`
  if (prefix.startsWith('/') && afterPrefix.startsWith('/')) {
    return null;
  }

  const query = afterPrefix.trim();
  if (query.length < 2) {
    return null;
  }

  return {
    start: idx,
    end: cursorOffset,
    query,
  };
}
