import { type CSSProperties } from 'react';
import { splitLineIntoSegments, type ChordDataEntry } from '../utils/chords';

interface ChordDisplayProps {
  chordsData: ChordDataEntry[];
  language: 'he' | 'en';
  fontSize: number;
}

export default function ChordDisplay({ chordsData, language, fontSize }: ChordDisplayProps) {
  const isRTL = language === 'he';
  const dir = isRTL ? 'rtl' : 'ltr';

  const containerStyle: CSSProperties = {
    direction: dir,
    fontFamily: isRTL ? 'var(--font-hebrew)' : 'var(--font-english)',
    fontSize: `${fontSize}px`,
    lineHeight: 1.5,
    padding: '16px 0',
  };

  return (
    <div style={containerStyle}>
      {chordsData.map((entry, i) => {
        if (entry.type === 'section') {
          return <SectionHeader key={i} content={entry.content} isRTL={isRTL} />;
        }
        const segments = splitLineIntoSegments(entry);
        const hasChords = entry.chords.length > 0;
        return (
          <div key={i} style={{ marginBottom: hasChords ? 8 : 2, direction: dir }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', direction: dir }}>
              {segments.map((seg, j) => (
                <span
                  key={j}
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    verticalAlign: 'top',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {/* Chord row */}
                  <span
                    dir="ltr"
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-chord)',
                      fontWeight: 700,
                      color: 'var(--color-chord)',
                      fontSize: `${fontSize * 0.9}px`,
                      minHeight: hasChords ? `${fontSize * 1.3}px` : 0,
                      unicodeBidi: 'isolate',
                      direction: 'ltr',
                      textAlign: isRTL ? 'right' : 'left',
                      userSelect: 'all',
                    }}
                  >
                    {seg.chord || '\u00A0'}
                  </span>
                  {/* Lyrics row */}
                  <span
                    style={{
                      display: 'block',
                      direction: dir,
                    }}
                  >
                    {seg.text || '\u00A0'}
                  </span>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ content, isRTL }: { content: string; isRTL: boolean }) {
  return (
    <div
      style={{
        color: 'var(--color-section)',
        fontWeight: 700,
        fontSize: '0.9em',
        margin: '20px 0 8px',
        padding: '4px 12px',
        background: 'rgba(255,217,61,0.08)',
        borderRadius: 6,
        display: 'inline-block',
        direction: isRTL ? 'rtl' : 'ltr',
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      [{content}]
    </div>
  );
}
