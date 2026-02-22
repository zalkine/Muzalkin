import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

export type ChordLine = {
  type: 'chords' | 'lyrics' | 'section';
  content: string;
};

type Props = {
  data: ChordLine[];
};

const ChordDisplay = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
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
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#555',
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
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1a6fd4',
                  lineHeight: '20px',
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
                  fontSize: 16,
                  color: '#111',
                  lineHeight: '24px',
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
