/**
 * JamBanner
 *
 * A thin sticky bar shown at the top of the app whenever a jam session is
 * active. Displays the session code, participant count, and a leave/end button.
 *
 * Host sees:  🎸 ABC123  👥 3  [End Session]
 * Viewer sees: 🎸 ABC123  👥 3  [Leave]
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJam } from '../lib/jamContext';

type Props = {
  /** Called after the host ends or viewer leaves — parent can navigate away. */
  onLeft?: () => void;
};

export default function JamBanner({ onLeft }: Props) {
  const { t } = useTranslation();
  const jam    = useJam();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!jam.sessionCode) return null;

  const shareUrl = `${window.location.origin}/jam/${jam.sessionCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLeaveOrEnd = async () => {
    setLeaving(true);
    if (jam.role === 'host') {
      await jam.endSession();
    } else {
      jam.leaveSession();
    }
    onLeft?.();
    setLeaving(false);
  };

  const isHost = jam.role === 'host';

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
      padding:         '6px 12px',
      backgroundColor: 'var(--accent)',
      color:           '#fff',
      fontSize:        13,
      gap:             8,
      flexShrink:      0,
    }}>
      {/* Left: icon + code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>🎸</span>
        <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>
          {jam.sessionCode}
        </span>
        {/* Copy link button */}
        <button
          onClick={handleCopy}
          title={t('jam_copy_link')}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none', borderRadius: 4,
            color: '#fff', fontSize: 11, fontWeight: 600,
            padding: '2px 7px', cursor: 'pointer',
          }}
        >
          {copied ? '✓' : t('jam_copy')}
        </button>
      </div>

      {/* Centre: participant count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>👥</span>
        <span style={{ fontWeight: 600 }}>{jam.participantCount}</span>
        <span style={{ opacity: 0.85 }}>
          {isHost ? t('jam_host_label') : t('jam_viewer_label')}
        </span>
      </div>

      {/* Right: leave/end */}
      <button
        onClick={handleLeaveOrEnd}
        disabled={leaving}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none', borderRadius: 5,
          color: '#fff', fontSize: 12, fontWeight: 700,
          padding: '4px 10px', cursor: 'pointer',
          opacity: leaving ? 0.6 : 1,
        }}
      >
        {isHost ? t('jam_end') : t('jam_leave')}
      </button>
    </div>
  );
}
