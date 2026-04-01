import { forwardRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------


/** Legacy format — separate chord/lyric lines */
export type ChordLineSimple = {
  type: 'chords' | 'lyrics' | 'section';
  content: string;
};

/**
 * Rich format — chord positioned above its lyric segment.
 * Each segment pairs an optional chord with the lyric text that follows it.
 * e.g.  D | שוב  +  Dmaj7 | אני מוצץ גבעול
 */
export type ChordLineInline = {
  type: 'line';
  segments: Array<{ chord: string; lyric: string }>;
};

export type ChordLine = ChordLineSimple | ChordLineInline;

// ---------------------------------------------------------------------------
// Inline conversion helpers
// ---------------------------------------------------------------------------

const CHORD_TOKEN_RE = /[A-G][#b]?(m|maj|min|sus[24]?|dim|aug|add\d+|[0-9])*(?:\/[A-G][#b]?)?/g;

/**
 * Convert a chord string + lyric string into an inline segment line.
 * Chord character positions in the chord string determine which word each
 * chord sits above (Tab4U encodes positions this way for monospace display).
 */
function simpleToInline(chordContent: string, lyricContent: string): ChordLineInline {
  const chordEntries: Array<{ chord: string; pos: number }> = [];
  CHORD_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CHORD_TOKEN_RE.exec(chordContent)) !== null) {
    chordEntries.push({ chord: m[0], pos: m.index });
  }

  if (chordEntries.length === 0) {
    return { type: 'line', segments: [{ chord: '', lyric: lyricContent }] };
  }

  // Find word start positions in the lyric (index of first non-space after a space, or index 0)
  const wordStarts: number[] = [];
  for (let i = 0; i < lyricContent.length; i++) {
    if (lyricContent[i] !== ' ' && (i === 0 || lyricContent[i - 1] === ' ')) {
      wordStarts.push(i);
    }
  }

  if (wordStarts.length === 0) {
    return { type: 'line', segments: chordEntries.map(e => ({ chord: e.chord, lyric: '' })) };
  }

  // Assign each chord to the first unused word start at or after its character position.
  // This mirrors monospace alignment: chord at char N lands on the word starting at char N
  // (or the next space-delimited word if that exact position isn't a word start).
  const usedPos = new Set<number>();
  const assignments: Array<{ chord: string; pos: number }> = [];

  for (const entry of chordEntries) {
    let wi = 0;
    // Advance to first word start >= chord position
    while (wi < wordStarts.length - 1 && wordStarts[wi] < entry.pos) wi++;
    // Resolve collisions: if this word start is taken, move to next
    while (usedPos.has(wordStarts[wi]) && wi < wordStarts.length - 1) wi++;
    const pos = wordStarts[wi];
    usedPos.add(pos);
    assignments.push({ chord: entry.chord, pos });
  }

  assignments.sort((a, b) => a.pos - b.pos);

  const segments: Array<{ chord: string; lyric: string }> = [];

  if (assignments[0].pos > 0) {
    segments.push({ chord: '', lyric: lyricContent.slice(0, assignments[0].pos) });
  }
  for (let i = 0; i < assignments.length; i++) {
    const start = assignments[i].pos;
    const end = i + 1 < assignments.length ? assignments[i + 1].pos : lyricContent.length;
    segments.push({ chord: assignments[i].chord, lyric: lyricContent.slice(start, end) });
  }

  return { type: 'line', segments };
}

/**
 * Pre-process lines: convert consecutive {chords} + {lyrics} pairs into
 * inline segment lines so each chord floats above its word.
 */
function toInlineFormat(data: ChordLine[]): ChordLine[] {
  const result: ChordLine[] = [];
  let i = 0;
  while (i < data.length) {
    const line = data[i];
    if (line.type === 'chords') {
      const next = data[i + 1];
      if (next?.type === 'lyrics') {
        result.push(simpleToInline(line.content, next.content));
        i += 2;
        continue;
      }
    }
    result.push(line);
    i++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  data: ChordLine[];
  fontSize?: number;
  isRTL?: boolean;
};

const ChordDisplay = forwardRef<HTMLDivElement, Props>(
  ({ data, fontSize = 1, isRTL = false }, ref) => {
    const processed = toInlineFormat(data);

    return (
      <div
        ref={ref}
        style={{
          padding: '12px 16px',
          direction: isRTL ? 'rtl' : 'ltr',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {processed.map((line, i) => {
          // ── Rich inline format ──────────────────────────────────────────
          if (line.type === 'line') {
            const { segments } = line;
            const hasAnyChord = segments.some(s => s.chord?.trim());
            const topPad = hasAnyChord ? Math.round(22 * fontSize) : 0;

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  // row-reverse puts seg[0] on the RIGHT for RTL songs, matching
                  // the Hebrew reading direction (first lyric word is rightmost).
                  // direction:'ltr' overrides the inherited RTL so the flex engine
                  // doesn't double-reverse the item order.
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  direction: 'ltr',
                  flexWrap: 'wrap',
                  marginBottom: 4,
                  paddingTop: topPad,
                  lineHeight: `${Math.round(26 * fontSize)}px`,
                }}
              >
                {segments.map((seg, si) => (
                  <span
                    key={si}
                    style={{ position: 'relative', display: 'inline-block', direction: isRTL ? 'rtl' : 'ltr' }}
                  >
                    {/* Chord floated above the lyric segment */}
                    {seg.chord?.trim() && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -topPad,
                          [isRTL ? 'right' : 'left']: 0,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: Math.round(13 * fontSize),
                          color: 'var(--accent)',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                        }}
                      >
                        {seg.chord}
                      </span>
                    )}
                    {/* Lyric text */}
                    <span
                      style={{
                        fontSize: Math.round(16 * fontSize),
                        color: 'var(--text)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {seg.lyric}
                    </span>
                  </span>
                ))}
              </div>
            );
          }

          // ── Legacy simple formats ───────────────────────────────────────
          // For chords+lyrics pairs: peek at next line to render them together
          // so the chord row sits flush above the lyric row with no gap.
          if (line.type === 'chords') {
            const nextLine = data[i + 1];
            const hasLyricBelow = nextLine?.type === 'lyrics';
            return (
              <div
                key={i}
                style={{
                  marginTop: Math.round(14 * fontSize),
                  marginBottom: 0,
                  lineHeight: 1,
                }}
              >
                {/* Chord row */}
                <div style={{ marginBottom: Math.round(2 * fontSize) }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: Math.round(14 * fontSize),
                      fontWeight: 700,
                      color: 'var(--accent)',
                      whiteSpace: 'pre',
                      letterSpacing: Math.round(2 * fontSize) + 'px',
                    }}
                  >
                    {line.content}
                  </span>
                </div>
                {/* Lyric row rendered here so chord+lyric are one visual block */}
                {hasLyricBelow && (
                  <div style={{ marginBottom: Math.round(4 * fontSize) }}>
                    <span
                      style={{
                        fontSize: Math.round(17 * fontSize),
                        color: 'var(--text)',
                        lineHeight: `${Math.round(26 * fontSize)}px`,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {nextLine.content}
                    </span>
                  </div>
                )}
              </div>
            );
          }

          switch (line.type) {
            case 'section':
              return (
                <div key={i} style={{ marginTop: Math.round(22 * fontSize), marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: Math.round(13 * fontSize),
                      fontWeight: 700,
                      color: 'var(--text2)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                    }}
                  >
                    {line.content}
                  </span>
                </div>
              );

            case 'lyrics': {
              // Skip if already rendered above by the preceding 'chords' block
              const prevLine = data[i - 1];
              if (prevLine?.type === 'chords') return null;
              return (
                <div key={i} style={{ marginBottom: Math.round(4 * fontSize) }}>
                  <span
                    style={{
                      fontSize: Math.round(17 * fontSize),
                      color: 'var(--text)',
                      lineHeight: `${Math.round(26 * fontSize)}px`,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {line.content}
                  </span>
                </div>
              );
            }

            default:
              return null;
          }
        })}
      </div>
    );
  },
);

ChordDisplay.displayName = 'ChordDisplay';
export default ChordDisplay;
