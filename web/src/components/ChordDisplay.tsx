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
          padding: '12px 16px',
          direction: isRTL ? 'rtl' : 'ltr',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {data.map((line, i) => {
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
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  marginBottom: 4,
                  paddingTop: topPad,
                  lineHeight: `${Math.round(26 * fontSize)}px`,
                }}
              >
                {segments.map((seg, si) => (
                  <span
                    key={si}
                    style={{ position: 'relative', display: 'inline-block' }}
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
          switch (line.type) {
            case 'section':
              return (
                <div key={i} style={{ marginTop: 20, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: Math.round(12 * fontSize),
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

            case 'chords':
              return (
                <div key={i} style={{ marginTop: 10 }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: Math.round(14 * fontSize),
                      fontWeight: 700,
                      color: 'var(--accent)',
                      lineHeight: `${Math.round(20 * fontSize)}px`,
                      whiteSpace: 'pre',
                    }}
                  >
                    {line.content}
                  </span>
                </div>
              );

            case 'lyrics':
              return (
                <div key={i} style={{ marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: Math.round(16 * fontSize),
                      color: 'var(--text)',
                      lineHeight: `${Math.round(26 * fontSize)}px`,
                      whiteSpace: 'pre-wrap',
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
