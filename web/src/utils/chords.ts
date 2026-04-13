import type { ChordLine, ChordLineInline } from '../components/ChordDisplay';

// Matches standard chord notation: Am, G#, Fmaj7, Dsus4, C/E, etc.
const CHORD_TOKEN_RE =
  /[A-G][#b]?(m(?:aj\d*)?|min|sus[24]?|dim|aug|add\d+|\d+)*(?:\/[A-G][#b]?)?/g;

/**
 * Insert \xa0 between merged adjacent chord names before tokenisation.
 * e.g. "CAm" → "C\xa0Am",  "AmFmaj7" → "Am\xa0Fmaj7",  "GbFm" → "Gb\xa0Fm"
 *
 * This must run on the raw chord LINE (not individual chord tokens) so that
 * the RTL position math (lyricPos = L − 1 − start) uses a string where each
 * chord is separated by at least one character.  Without this, two merged
 * chords at positions 0 and 1 produce a 1-char-wide lyric slice, which
 * breaks every Hebrew word into individual spaced-out letters.
 */
function separateMergedChords(s: string): string {
  let prev = '';
  let curr = s;
  while (curr !== prev) {
    prev = curr;
    curr = curr.replace(/([A-Za-z\d])([A-G])/g, '$1\u00a0$2');
    curr = curr.replace(/([#b])([A-G])/g, '$1\u00a0$2');
  }
  return curr;
}

/**
 * Parse a chord line + lyric line into a segment-based ChordLineInline.
 *
 * LTR (English, Ultimate Guitar):
 *   Chord position P in the string aligns directly with lyric position P.
 *
 * RTL (Hebrew, Tab4U):
 *   Tab4U renders chord rows as  direction:ltr / text-align:right  so the
 *   LAST character of the chord string is at the right edge.  The chord at
 *   string index P therefore sits at (chordLine.length − 1 − P) columns
 *   from the right edge, which is exactly lyric column Q = L−1−P (same
 *   monospace font, same cell width).
 *
 *   After mapping every chord to its lyric column Q we sort ascending by Q
 *   (= right-to-left reading order) and slice the lyric at those Q positions.
 *   The segments are returned in RTL reading order so that ChordDisplay can
 *   render them with flexDirection:row-reverse and have segment[0] land on
 *   the far right.
 */
export function parseChordLyricPair(
  chordLine: string,
  lyricLine: string,
  isRTL = false,
): ChordLineInline {
  // Pre-process: ensure merged chord names (e.g. "CAm", "AmFmaj7") are
  // separated by \xa0 before tokenisation.  Without this, adjacent chords at
  // string positions 0 and 1 produce a 1-char-wide lyric slice, which splits
  // Hebrew words into individual spaced-out letters.
  const cl = separateMergedChords(chordLine);

  const matches: Array<{ chord: string; start: number }> = [];
  CHORD_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CHORD_TOKEN_RE.exec(cl)) !== null) {
    matches.push({ chord: m[0], start: m.index });
  }

  if (matches.length === 0) {
    return { type: 'line', segments: [{ chord: '', lyric: lyricLine }] };
  }

  if (isRTL) {
    const L = cl.length;
    // Map each chord's string position P → lyric column Q = L−1−P,
    // then sort ascending by Q (rightmost lyric position first).
    const mapped = matches
      .map(({ chord, start }) => ({ chord, lyricPos: L - 1 - start }))
      .sort((a, b) => a.lyricPos - b.lyricPos);

    const segments: ChordLineInline['segments'] = [];
    const prefixLen = mapped[0].lyricPos;
    if (prefixLen > 0) {
      segments.push({ chord: '', lyric: lyricLine.slice(0, prefixLen) });
    }
    for (let i = 0; i < mapped.length; i++) {
      const lyricStart = mapped[i].lyricPos;
      const lyricEnd = i + 1 < mapped.length ? mapped[i + 1].lyricPos : undefined;
      segments.push({
        chord: mapped[i].chord,
        lyric: lyricEnd !== undefined
          ? lyricLine.slice(lyricStart, lyricEnd)
          : lyricLine.slice(lyricStart),
      });
    }
    return { type: 'line', segments };
  }

  // ── LTR path ────────────────────────────────────────────────────────────
  const segments: ChordLineInline['segments'] = [];
  const lyricPrefix = lyricLine.slice(0, matches[0].start);

  for (let i = 0; i < matches.length; i++) {
    const lyricStart = matches[i].start;
    const lyricEnd = i + 1 < matches.length ? matches[i + 1].start : undefined;
    const lyric =
      lyricEnd !== undefined
        ? lyricLine.slice(lyricStart, lyricEnd)
        : lyricLine.slice(lyricStart);
    segments.push({ chord: matches[i].chord, lyric });
  }

  // Any lyric text before the first chord becomes its own chord-less segment
  // so the first chord sits exactly above its own lyric text, not the prefix.
  if (lyricPrefix) {
    segments.unshift({ chord: '', lyric: lyricPrefix });
  }

  return { type: 'line', segments };
}

/**
 * Convert legacy chords_data (alternating 'chords'/'lyrics' pairs) into
 * segment-based 'line' entries for correct RTL/LTR chord placement.
 * Sections and standalone lyric lines are passed through unchanged.
 * Data already in 'line' format is also passed through unchanged.
 *
 * RTL (Hebrew/Tab4U): the chord strings use \xa0 characters to position each
 * chord above its syllable assuming a fixed-width monospace cell — exactly how
 * Tab4U renders them.  Converting to 'line' segments slices the Hebrew lyric
 * at position-derived boundaries that split Hebrew words, causing "יל ד" gaps.
 * Keep RTL data in legacy monospace mode so both rows share the same monospace
 * font and the \xa0 alignment works as Tab4U intended.
 */
export function normalizeChordData(data: ChordLine[], isRTL = false): ChordLine[] {
  if (isRTL) return data;

  const result: ChordLine[] = [];
  let i = 0;

  while (i < data.length) {
    const line = data[i];

    if (line.type === 'chords') {
      const next = data[i + 1];
      if (next?.type === 'lyrics') {
        result.push(parseChordLyricPair(line.content, next.content, isRTL));
        i += 2;
      } else {
        // Chord-only line (e.g. intro riff with no lyric) — keep as-is so
        // ChordDisplay can render tokens in a proper horizontal row.
        result.push(line);
        i++;
      }
      continue;
    }

    // Already inline format, section, or standalone lyric — pass through
    result.push(line);
    i++;
  }

  return result;
}
