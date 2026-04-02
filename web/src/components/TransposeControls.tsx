import { useTranslation } from 'react-i18next';

interface TransposeControlsProps {
  transpose: number;
  onTransposeChange: (value: number) => void;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
}

const btnStyle: React.CSSProperties = {
  background: 'var(--color-surface-hover)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  width: 36,
  height: 36,
  borderRadius: 8,
  fontSize: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text-secondary)',
  minWidth: 50,
  textAlign: 'center',
};

export default function TransposeControls({
  transpose,
  onTransposeChange,
  fontSize,
  onFontSizeChange,
}: TransposeControlsProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '12px 0',
      }}
    >
      {/* Transpose */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={labelStyle}>{t('transpose')}</span>
        <button style={btnStyle} onClick={() => onTransposeChange(transpose - 1)}>
          −
        </button>
        <span
          style={{
            minWidth: 32,
            textAlign: 'center',
            fontFamily: 'var(--font-english)',
            fontWeight: 600,
            color: transpose === 0 ? 'var(--color-text-secondary)' : 'var(--color-accent)',
          }}
        >
          {transpose > 0 ? `+${transpose}` : transpose}
        </span>
        <button style={btnStyle} onClick={() => onTransposeChange(transpose + 1)}>
          +
        </button>
      </div>

      {/* Font size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={labelStyle}>A</span>
        <button style={btnStyle} onClick={() => onFontSizeChange(Math.max(12, fontSize - 2))}>
          −
        </button>
        <span
          style={{
            minWidth: 32,
            textAlign: 'center',
            fontFamily: 'var(--font-english)',
            fontWeight: 600,
          }}
        >
          {fontSize}
        </span>
        <button style={btnStyle} onClick={() => onFontSizeChange(Math.min(32, fontSize + 2))}>
          +
        </button>
      </div>

      {/* Reset */}
      {(transpose !== 0 || fontSize !== 16) && (
        <button
          onClick={() => {
            onTransposeChange(0);
            onFontSizeChange(16);
          }}
          style={{
            ...btnStyle,
            width: 'auto',
            padding: '0 12px',
            fontSize: 13,
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}
