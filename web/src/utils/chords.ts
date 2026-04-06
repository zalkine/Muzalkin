import type { ChordLine, ChordLineInline } from '../components/ChordDisplay';

// Matches standard chord notation: Am, G#, Fmaj7, Dsus4, C/E, etc.
const CHORD_TOKEN_RE =
  /[A-G][#b]?(m(?:aj\d*)?|min|sus[24]?|dim|aug|add\d+|\d+)*(?:\/[A-G][#b]?)?/g;

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
  const matches: Array<{ chord: string; start: number }> = [];
  CHORD_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CHORD_TOKEN_RE.exec(chordLine)) !== null) {
    matches.push({ chord: m[0], start: m.index });
  }

  if (matches.length === 0) {
    return { type: 'line', segments: [{ chord: '', lyric: lyricLine }] };
  }

  if (isRTL) {
    const L = chordLine.length;
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
 */
export function normalizeChordData(data: ChordLine[], isRTL = false): ChordLine[] {
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
