import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

export type ChordLine = {
  type: 'chords' | 'lyrics' | 'section';
  content: string;
};

type Props = {
  data: ChordLine[];
  fontSize?: number; // multiplier, default 1.0
};

const ChordDisplay = forwardRef<HTMLDivElement, Props>(({ data, fontSize = 1 }, ref) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

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
        switch (line.type) {
          case 'section':
            return (
              <div key={i} style={{ marginTop: 20, marginBottom: 4 }}>
                <span style={{
                  fontSize: Math.round(12 * fontSize),
                  fontWeight: 700,
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                }}>
                  {line.content}
                </span>
              </div>
            );

          case 'chords':
            return (
              <div key={i} style={{ marginTop: 10 }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: Math.round(14 * fontSize),
                  fontWeight: 700,
                  color: 'var(--accent)',
                  lineHeight: `${Math.round(20 * fontSize)}px`,
                  whiteSpace: 'pre',
                }}>
                  {line.content}
                </span>
              </div>
            );

          case 'lyrics':
            return (
              <div key={i} style={{ marginBottom: 2 }}>
                <span style={{
                  fontSize: Math.round(16 * fontSize),
                  color: 'var(--text)',
                  lineHeight: `${Math.round(26 * fontSize)}px`,
                  whiteSpace: 'pre-wrap',
                }}>
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
});

ChordDisplay.displayName = 'ChordDisplay';

export default ChordDisplay;
