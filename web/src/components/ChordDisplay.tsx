import { forwardRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Legacy format — separate chord/lyric lines */
export type ChordLineSimple = {
  type: 'chords' | 'lyrics' | 'section' | 'tab';
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
  showTabs?: boolean;
};

const ChordDisplay = forwardRef<HTMLDivElement, Props>(
  ({ data, fontSize = 1, isRTL = false, showTabs = false }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          padding: '16px 20px',
          direction: isRTL ? 'rtl' : 'ltr',
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          overflowX: 'auto',
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
            // no syllables to align against, so collapse runs of spaces/\u00a0
            // to a single space to avoid visually excessive gaps.
            // Tab4U uses \u00a0 for positioning; Cifraclub uses regular spaces.
            const chordContent = hasLyricBelow
              ? splitMergedChords(line.content)
              : splitMergedChords(line.content).replace(/[\u00a0 ]+/g, ' ').trim();
            // ui-monospace → SF Mono (iOS), Cascadia/Consolas (Windows), system mono
            // (Android) — all significantly narrower than Courier New, fitting more
            // content on small screens. Courier New is the last resort fallback only.
            const MONO = 'ui-monospace, Consolas, "Courier New", monospace';
            const monoSize = Math.round(15 * fontSize);
            // LTR: scale font-size with viewport width so lines fit on mobile without
            // horizontal scrolling. clamp() keeps a readable minimum (11px) and caps at
            // the user's chosen size on tablets/desktop.
            // RTL: fixed px — Tab4U's \xa0 alignment is calibrated for a fixed cell width.
            const monoFontSize = isRTL
              ? monoSize
              : `clamp(11px, ${(monoSize / 480 * 100).toFixed(1)}vw, ${monoSize}px)`;
            return (
              <div
                key={i}
                style={{
                  marginTop: Math.round((isRTL ? 16 : 8) * fontSize),
                  marginBottom: Math.round(2 * fontSize),
                }}
              >
                {/* Chord row — raw string, whiteSpace:pre preserves &nbsp;
                    RTL: direction:ltr + textAlign:right matches Tab4U's CSS exactly
                    (Tab4U renders chord rows as direction:ltr / text-align:right so
                    the last character of the chord string sits at the right edge,
                    which aligns each chord above its correct Hebrew syllable). */}
                <div style={{
                  fontFamily: MONO,
                  fontSize: monoFontSize,
                  fontWeight: 700,
                  color: 'var(--chord-color)',
                  whiteSpace: 'pre',
                  lineHeight: 1.4,
                  direction: 'ltr',
                  textAlign: isRTL ? 'right' : 'left',
                }}>
                  {chordContent}
                </div>
                {/* Lyric row — same monospace font + size so character widths match */}
                {hasLyricBelow && (
                  <div style={{
                    fontFamily: MONO,
                    fontSize: monoFontSize,
                    color: 'var(--text)',
                    whiteSpace: 'pre',
                    lineHeight: 1.55,
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
                    marginTop: Math.round((isRTL ? 28 : 14) * fontSize),
                    marginBottom: Math.round((isRTL ? 8 : 4) * fontSize),
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
              // RTL: monospace so \xa0 chord alignment is preserved.
              // LTR: proportional font, matching the inline segment renderer.
              const isMonoLyric = isRTL;
              const lyricSize = isMonoLyric ? Math.round(15 * fontSize) : Math.round(16 * fontSize);
              return (
                <div key={i} style={{ marginBottom: Math.round(2 * fontSize) }}>
                  <span
                    style={{
                      fontFamily: isMonoLyric
                        ? '"Courier New", Courier, monospace'
                        : "'Segoe UI', system-ui, -apple-system, sans-serif",
                      fontSize: lyricSize,
                      color: 'var(--text)',
                      lineHeight: `${Math.round(lyricSize * 1.55)}px`,
                      whiteSpace: isMonoLyric ? 'pre' : 'pre-wrap',
                      direction: isRTL ? 'rtl' : 'ltr',
                    }}
                  >
                    {isMonoLyric ? line.content : line.content.trim()}
                  </span>
                </div>
              );
            }

            case 'tab':
              if (!showTabs) return null;
              return (
                <div key={i} style={{ marginBottom: Math.round(1 * fontSize) }}>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, Consolas, "Courier New", monospace',
                      fontSize: Math.round(13 * fontSize),
                      color: 'var(--text3)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre',
                      direction: 'ltr',
                    }}
                  >
                    {line.content}
                  </span>
                </div>
              );

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
