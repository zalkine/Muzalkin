/**
 * StartJamModal
 *
 * Shown when the host clicks "שירה בציבור" on a song page.
 * Creates a jam session and shows the join code + share URL.
 *
 * State machine:
 *   idle → starting → active
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJam, type SongRef } from '../lib/jamContext';

type Props = {
  song:      SongRef;
  isRTL:     boolean;
  onStarted: (code: string) => void;
  onCancel:  () => void;
};

export default function StartJamModal({ song, isRTL, onStarted, onCancel }: Props) {
  const { t }   = useTranslation();
  const jam      = useJam();
  const [phase,  setPhase]  = useState<'idle' | 'starting' | 'active'>('idle');
  const [code,   setCode]   = useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleStart = async () => {
    setPhase('starting');
    const newCode = await jam.startSession(song);
    if (!newCode) {
      setPhase('idle');
      return;
    }
    setCode(newCode);
    setPhase('active');
    onStarted(newCode);
  };

  const shareUrl  = code ? `${window.location.origin}/jam/${code}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: t('jam_share_title'),
        text:  t('jam_share_text', { code }),
        url:   shareUrl,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, direction: isRTL ? 'rtl' : 'ltr' }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
          🎸 {t('jam_start_title')}
        </h2>

        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text2)' }}>
          {song.title} — {song.artist}
        </p>

        {phase === 'idle' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: '12px 0 0' }}>
              {t('jam_start_hint')}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={onCancel} style={cancelBtnStyle}>{t('cancel')}</button>
              <button onClick={handleStart} style={primaryBtnStyle}>{t('jam_start_btn')}</button>
            </div>
          </>
        )}

        {phase === 'starting' && (
          <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 20, textAlign: 'center' }}>
            {t('loading')}
          </p>
        )}

        {phase === 'active' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: '16px 0 6px' }}>
              {t('jam_code_label')}
            </p>
            {/* Big join code */}
            <div style={{
              fontSize: 36, fontWeight: 800, letterSpacing: '0.18em',
              color: 'var(--accent)', textAlign: 'center',
              padding: '10px 0', margin: '0 0 4px',
            }}>
              {code}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', margin: 0 }}>
              {t('jam_code_hint')}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleCopy} style={secondaryBtnStyle}>
                {copied ? '✓ ' + t('jam_copied') : t('jam_copy_link')}
              </button>
              <button onClick={handleShare} style={primaryBtnStyle}>{t('share')}</button>
            </div>
            <button onClick={onCancel} style={{ ...cancelBtnStyle, marginTop: 8, width: '100%' }}>
              {t('jam_dismiss')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, zIndex: 200,
};

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 380,
  backgroundColor: 'var(--card-bg)',
  borderRadius: 14, padding: '20px 20px 16px',
  display: 'flex', flexDirection: 'column', gap: 0,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};

const primaryBtnStyle: React.CSSProperties = {
  flex: 1, paddingBlock: 10,
  backgroundColor: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1, paddingBlock: 10,
  backgroundColor: 'var(--surface)', color: 'var(--accent)',
  border: '1px solid var(--accent)', borderRadius: 8, fontSize: 14, fontWeight: 700,
  cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1, paddingBlock: 10,
  backgroundColor: 'var(--surface)', color: 'var(--text2)',
  border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600,
  cursor: 'pointer',
};
