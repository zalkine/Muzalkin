import { useTranslation } from 'react-i18next';
import { usePitchDetection } from '../hooks/usePitchDetection';

const GUITAR_STRINGS = [
  { note: 'E', octave: 2 },
  { note: 'A', octave: 2 },
  { note: 'D', octave: 3 },
  { note: 'G', octave: 3 },
  { note: 'B', octave: 3 },
  { note: 'E', octave: 4 },
] as const;

function centsColor(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= 5)  return '#22c55e';
  if (abs <= 15) return '#84cc16';
  if (abs <= 30) return '#f59e0b';
  return '#ef4444';
}

export default function TunerPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const { result, isActive, error, start, stop } = usePitchDetection();

  const cents     = result?.cents ?? 0;
  const noteColor = result ? centsColor(cents) : 'var(--text3)';
  // Map −50…+50 cents to 0%…100% needle position
  const needlePct = result ? Math.max(0, Math.min(100, (cents + 50) / 100 * 100)) : 50;

  const statusLabel = result
    ? (Math.abs(cents) <= 5
        ? t('tuner_in_tune')
        : cents < 0 ? t('tuner_flat') : t('tuner_sharp'))
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
          {t('tuner_title')}
        </h1>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        gap: 20,
        overflowY: 'auto',
      }}>

        {/* Note circle */}
        <div style={{
          width: 160,
          height: 160,
          borderRadius: '50%',
          border: `3px solid ${noteColor}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface)',
          boxShadow: result ? `0 0 32px ${noteColor}40` : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: result ? 72 : 40,
            fontWeight: 800,
            color: noteColor,
            lineHeight: 1,
            transition: 'color 0.15s, font-size 0.1s',
            fontFamily: 'Sora, system-ui, sans-serif',
          }}>
            {result ? result.note : '—'}
          </span>
          {result && (
            <span style={{ fontSize: 22, color: 'var(--text2)', fontWeight: 600 }}>
              {result.octave}
            </span>
          )}
        </div>

        {/* Frequency & status */}
        <div style={{ textAlign: 'center', minHeight: 44 }}>
          <div style={{ color: 'var(--text2)', fontSize: 16 }}>
            {result
              ? `${result.frequency} Hz`
              : isActive ? t('tuner_hint') : ''}
          </div>
          <div style={{ color: noteColor, fontSize: 14, fontWeight: 600, marginTop: 4, transition: 'color 0.15s' }}>
            {statusLabel ?? '\u00A0'}
          </div>
        </div>

        {/* Cents meter */}
        <div style={{ width: '100%', maxWidth: 320 }}>
          {/* FLAT / center / SHARP labels */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            marginBottom: 6,
            fontSize: 11,
            color: 'var(--text3)',
          }}>
            <span>{t('tuner_flat')} −50</span>
            <span>0</span>
            <span>+50 {t('tuner_sharp')}</span>
          </div>

          {/* Track */}
          <div style={{
            position: 'relative',
            height: 12,
            borderRadius: 6,
            background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 25%, #22c55e 45%, #22c55e 55%, #f59e0b 75%, #ef4444 100%)',
          }}>
            {/* Centre tick */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: -5,
              transform: 'translateX(-50%)',
              width: 2,
              height: 22,
              background: 'var(--text)',
              borderRadius: 1,
              opacity: 0.35,
            }} />
            {/* Needle */}
            <div style={{
              position: 'absolute',
              left: `${needlePct}%`,
              top: -7,
              transform: 'translateX(-50%)',
              width: 4,
              height: 26,
              borderRadius: 2,
              background: noteColor,
              boxShadow: `0 0 8px ${noteColor}`,
              transition: result ? 'left 0.1s ease-out, background 0.2s' : 'background 0.2s',
            }} />
          </div>

          {/* Cents value */}
          <div style={{
            textAlign: 'center',
            marginTop: 8,
            fontSize: 13,
            color: noteColor,
            minHeight: 18,
            transition: 'color 0.15s',
          }}>
            {result ? `${cents >= 0 ? '+' : ''}${cents}¢` : ''}
          </div>
        </div>

        {/* Guitar string reference */}
        <div style={{
          display: 'flex',
          gap: 6,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          {GUITAR_STRINGS.map(s => {
            const active = result?.note === s.note && result?.octave === s.octave;
            return (
              <div key={`${s.note}${s.octave}`} style={{
                width: 44,
                padding: '6px 0',
                borderRadius: 8,
                border: `1px solid ${active ? noteColor : 'var(--border)'}`,
                background: active ? `${noteColor}20` : 'var(--surface)',
                textAlign: 'center',
                transition: 'border-color 0.15s, background 0.15s',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? noteColor : 'var(--text)' }}>
                  {s.note}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.octave}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          margin: '0 20px 12px',
          padding: '12px 16px',
          borderRadius: 10,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#f87171',
          fontSize: 14,
          textAlign: 'center',
        }}>
          {error === 'permission_denied' ? t('tuner_permission_denied') : t('tuner_mic_error')}
        </div>
      )}

      {/* Start / Stop button */}
      <div style={{ padding: '0 20px 24px' }}>
        <button
          onClick={isActive ? stop : start}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 12,
            border: 'none',
            background: isActive ? 'rgba(239,68,68,0.15)' : 'var(--accent)',
            color: isActive ? '#f87171' : '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {isActive ? t('tuner_stop') : t('tuner_start')}
        </button>
      </div>
    </div>
  );
}
