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
// Helper: fix merged chord names
// ---------------------------------------------------------------------------

/**
 * Insert a space wherever two chord names are concatenated with no separator.
 * e.g. "CAm" → "C Am",  "AmC" → "Am C",  "C#Am" → "C# Am",  "BbG" → "Bb G"
 *
 * Safe cases (not split):
 *   "Cmaj7"  — modifier letters are lowercase, not a new chord root
 *   "C#m"    — # is a modifier, m is lowercase
 *   "Bb"     — single flat-chord, no following root
 *   "Am\xa0C"— already separated by non-breaking space → unchanged
 */
function splitMergedChords(s: string): string {
  let prev = '';
  let curr = s;
  // Loop until stable (handles triple merges like "CAmG" in two passes)
  while (curr !== prev) {
    prev = curr;
    // Case 1: any letter or digit immediately before an uppercase chord root
    //   "CAm" → C before A → "C Am"
    //   "AmC" → m before C → "Am C"
    //   "BbG" → b before G → "Bb G"
    // [A-G] is uppercase-only, so "Cmaj7", "C#m", "Bb" are not split.
    curr = curr.replace(/([A-Za-z\d])([A-G])/g, '$1\u00a0$2');
    // Case 2: sharp/flat modifier immediately before a chord root
    //   "C#Am" → # before A → "C# Am"
    //   "GbFm" → b before F → "Gb Fm"
    curr = curr.replace(/([#b])([A-G])/g, '$1\u00a0$2');
  }
  return curr;
}


type Props = {
  data: ChordLine[];
  fontSize?: number;
  isRTL?: boolean;
};

const ChordDisplay = forwardRef<HTMLDivElement, Props>(
  ({ data, fontSize = 1, isRTL = false }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          padding: '16px 20px',
          direction: isRTL ? 'rtl' : 'ltr',
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        }}
      >
        {data.map((line, i) => {
          // ── Rich inline format ──────────────────────────────────────────
          if (line.type === 'line') {
            const { segments } = line;
            const hasAnyChord = segments.some(s => s.chord?.trim());
            const chordHeight = Math.round(22 * fontSize);

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  // Explicit direction:ltr + row-reverse for RTL avoids
                  // double-reversal from the inherited direction:rtl on the
                  // outer container.
                  direction: 'ltr',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  marginBottom: Math.round(2 * fontSize),
                }}
              >
                {segments.map((seg, si) => (
                  <span
                    key={si}
                    style={{ display: 'inline-block', verticalAlign: 'top' }}
                  >
                    {/* Chord row — always rendered when any chord exists so
                        all lyric rows stay vertically aligned */}
                    {hasAnyChord && (
                      <span
                        style={{
                          display: 'block',
                          // Align chord text to the reading-start edge of the
                          // segment (right for RTL, left for LTR).
                          textAlign: isRTL ? 'right' : 'left',
                          fontFamily: '"Courier New", Courier, monospace',
                          fontWeight: 700,
                          fontSize: Math.round(14 * fontSize),
                          // Transparent keeps height/spacing when no chord
                          color: seg.chord?.trim()
                            ? 'var(--chord-color)'
                            : 'transparent',
                          direction: 'ltr',
                          whiteSpace: 'nowrap',
                          height: chordHeight,
                          lineHeight: `${chordHeight}px`,
                        }}
                      >
                        {seg.chord?.trim() ? splitMergedChords(seg.chord.trim()) : '\u00A0'}
                      </span>
                    )}
                    <span
                      style={{
                        display: 'block',
                        fontSize: Math.round(16 * fontSize),
                        color: 'var(--text)',
                        whiteSpace: 'pre',
                        lineHeight: `${Math.round(26 * fontSize)}px`,
                        direction: isRTL ? 'rtl' : 'ltr',
                        textAlign: isRTL ? 'right' : 'left',
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
          if (line.type === 'chords') {
            const nextLine = data[i + 1];
            const hasLyricBelow = nextLine?.type === 'lyrics';
            // Render chord content as-is with whiteSpace:'pre' so that the
            // &nbsp; (\u00a0) characters from the scraper are preserved and
            // position each chord exactly above its syllable.
            // Both chord and lyric rows use the same monospace font and the
            // same font size — the only way &nbsp; widths match across rows.
            //
            // Exception: chords-only lines (no lyric below, e.g. intro) have
            // no syllables to align against, so collapse runs of \u00a0 to a
            // single space to avoid visually excessive gaps.
            const chordContent = hasLyricBelow
              ? splitMergedChords(line.content)
              : splitMergedChords(line.content).replace(/\u00a0+/g, ' ').trim();
            const MONO = '"Courier New", Courier, monospace';
            const monoSize = Math.round(15 * fontSize);
            return (
              <div
                key={i}
                style={{
                  marginTop: Math.round(16 * fontSize),
                  marginBottom: Math.round(2 * fontSize),
                }}
              >
                {/* Chord row — raw string, whiteSpace:pre preserves &nbsp; */}
                <div style={{
                  fontFamily: MONO,
                  fontSize: monoSize,
                  fontWeight: 700,
                  color: 'var(--chord-color)',
                  whiteSpace: 'pre',
                  lineHeight: `${Math.round(monoSize * 1.4)}px`,
                  direction: isRTL ? 'rtl' : 'ltr',
                }}>
                  {chordContent}
                </div>
                {/* Lyric row — same monospace font + size so character widths match */}
                {hasLyricBelow && (
                  <div style={{
                    fontFamily: MONO,
                    fontSize: monoSize,
                    color: 'var(--text)',
                    whiteSpace: 'pre',
                    lineHeight: `${Math.round(monoSize * 1.55)}px`,
                    direction: isRTL ? 'rtl' : 'ltr',
                  }}>
                    {nextLine.content}
                  </div>
                )}
              </div>
            );
          }

          switch (line.type) {
            case 'section':
              return (
                <div
                  key={i}
                  style={{
                    marginTop: Math.round(28 * fontSize),
                    marginBottom: Math.round(8 * fontSize),
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: Math.round(12 * fontSize),
                      fontWeight: 700,
                      color: 'var(--chord-color)',
                      backgroundColor: 'color-mix(in srgb, var(--chord-color) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--chord-color) 35%, transparent)',
                      borderRadius: 4,
                      padding: `${Math.round(2 * fontSize)}px ${Math.round(8 * fontSize)}px`,
                      letterSpacing: '0.4px',
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
              const monoSize = Math.round(15 * fontSize);
              return (
                <div key={i} style={{ marginBottom: Math.round(2 * fontSize) }}>
                  <span
                    style={{
                      fontFamily: '"Courier New", Courier, monospace',
                      fontSize: monoSize,
                      color: 'var(--text)',
                      lineHeight: `${Math.round(monoSize * 1.55)}px`,
                      whiteSpace: 'pre',
                      direction: isRTL ? 'rtl' : 'ltr',
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
