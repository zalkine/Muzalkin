import type { ChordLine, ChordLineInline } from '../components/ChordDisplay';

// Matches standard chord notation: Am, G#, Fmaj7, Dsus4, C/E, etc.
const CHORD_TOKEN_RE =
  /[A-G][#b]?(m(?:aj\d*)?|min|sus[24]?|dim|aug|add\d+|\d+)*(?:\/[A-G][#b]?)?/g;

/**
 * Parse a chord line + lyric line into a segment-based ChordLineInline.
 *
 * Each chord's position (column index) in the chord line is used to slice
 * the lyric line at the same column, producing segments like:
 *   { chord: 'Am', lyric: 'מול חלון ק' }
 *   { chord: 'G',  lyric: 'טן בשקיעת'  }
 *   { chord: 'F',  lyric: 'חמה'         }
 *
 * When rendered with flexDirection: row-reverse (RTL), the first segment ends
 * up on the right — exactly where the first Hebrew word appears.
 */
export function parseChordLyricPair(
  chordLine: string,
  lyricLine: string,
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

  // Any lyric text before the first chord is prepended to the first segment
  if (lyricPrefix) {
    segments[0] = { chord: segments[0].chord, lyric: lyricPrefix + segments[0].lyric };
  }

  return { type: 'line', segments };
}

/**
 * Convert legacy chords_data (alternating 'chords'/'lyrics' pairs) into
 * segment-based 'line' entries for correct RTL/LTR chord placement.
 * Sections and standalone lyric lines are passed through unchanged.
 * Data already in 'line' format is also passed through unchanged.
 */
export function normalizeChordData(data: ChordLine[]): ChordLine[] {
  const result: ChordLine[] = [];
  let i = 0;

  while (i < data.length) {
    const line = data[i];

    if (line.type === 'chords') {
      const next = data[i + 1];
      if (next?.type === 'lyrics') {
        result.push(parseChordLyricPair(line.content, next.content));
        i += 2;
      } else {
        // Chord-only line (e.g. intro riff with no lyric)
        result.push(parseChordLyricPair(line.content, ''));
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
