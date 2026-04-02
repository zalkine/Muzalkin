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
// Component
// ---------------------------------------------------------------------------

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
            const chordRowHeight = Math.round(22 * fontSize);

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  marginBottom: Math.round(2 * fontSize),
                  paddingTop: hasAnyChord ? chordRowHeight : 0,
                  lineHeight: `${Math.round(26 * fontSize)}px`,
                }}
              >
                {segments.map((seg, si) => (
                  <span
                    key={si}
                    style={{ position: 'relative', display: 'inline-block' }}
                  >
                    {seg.chord?.trim() && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -chordRowHeight,
                          [isRTL ? 'right' : 'left']: 0,
                          fontFamily: '"Courier New", Courier, monospace',
                          fontWeight: 700,
                          fontSize: Math.round(14 * fontSize),
                          color: 'var(--chord-color)',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                          direction: 'ltr',
                          unicodeBidi: 'isolate',
                        }}
                      >
                        {seg.chord}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: Math.round(16 * fontSize),
                        color: 'var(--text)',
                        whiteSpace: 'pre-wrap',
                        lineHeight: `${Math.round(26 * fontSize)}px`,
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
            // Split into individual chord tokens. The DB stores them in RTL
            // visual order (first token = rightmost chord). flex-direction:
            // row-reverse places the first token on the right in RTL mode.
            const chordTokens = line.content.trim().split(/\s+/).filter(Boolean);
            return (
              <div
                key={i}
                style={{
                  marginTop: Math.round(16 * fontSize),
                  marginBottom: 0,
                }}
              >
                {/* Chord row — tokens laid out in correct RTL/LTR order */}
                <div style={{
                  display: 'flex',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'flex-end',
                  gap: Math.round(12 * fontSize),
                  lineHeight: 1.2,
                  marginBottom: Math.round(1 * fontSize),
                }}>
                  {chordTokens.map((chord, ci) => (
                    <span
                      key={ci}
                      style={{
                        fontFamily: '"Courier New", Courier, monospace',
                        fontSize: Math.round(14 * fontSize),
                        fontWeight: 700,
                        color: 'var(--chord-color)',
                      }}
                    >
                      {chord}
                    </span>
                  ))}
                </div>
                {/* Lyric row rendered here so chord+lyric are one visual block */}
                {hasLyricBelow && (
                  <div style={{ marginBottom: Math.round(2 * fontSize) }}>
                    <span
                      style={{
                        fontSize: Math.round(17 * fontSize),
                        color: 'var(--text)',
                        lineHeight: `${Math.round(27 * fontSize)}px`,
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
                <div
                  key={i}
                  style={{
                    marginTop: Math.round(28 * fontSize),
                    marginBottom: Math.round(8 * fontSize),
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
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
              return (
                <div key={i} style={{ marginBottom: Math.round(2 * fontSize) }}>
                  <span
                    style={{
                      fontSize: Math.round(17 * fontSize),
                      color: 'var(--text)',
                      lineHeight: `${Math.round(27 * fontSize)}px`,
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
