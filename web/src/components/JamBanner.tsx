/**
 * JamBanner
 *
 * Sticky bar shown at the top whenever a jam session is active.
 *
 * Jamaneger sees: 🎸 ABC123 [Copy] | ▶ Next | 👥 3 Jamaneger | [Queue] [Members] [End]
 * Jamember sees:  🎸 ABC123 [Copy] |          👥 3 Jamember  | [Queue] [Leave]
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJam } from '../lib/jamContext';

type Props = {
  onLeft?:         () => void;
  onOpenQueue?:    () => void;
  onOpenMembers?:  () => void;
};

export default function JamBanner({ onLeft, onOpenQueue, onOpenMembers }: Props) {
  const { t }  = useTranslation();
  const jam     = useJam();
  const [copied,  setCopied]  = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!jam.sessionCode) return null;

  const isJamaneger = jam.role === 'jamaneger';
  const shareUrl    = `${window.location.origin}/jam/${jam.sessionCode}`;

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
        text:  t('jam_share_text', { code: jam.sessionCode }),
        url:   shareUrl,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const handleLeaveOrEnd = async () => {
    setLeaving(true);
    if (isJamaneger) {
      await jam.endSession();
    } else {
      jam.leaveSession();
    }
    onLeft?.();
    setLeaving(false);
  };

  // Current song title from queue
  const currentSong = jam.queue.find(q => q.id === jam.currentQueueItemId);

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      padding:         '6px 12px',
      backgroundColor: 'var(--accent)',
      color:           '#fff',
      fontSize:        13,
      gap:             8,
      flexShrink:      0,
      flexWrap:        'wrap',
    }}>
      {/* ── Left: code + copy ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 16 }}>🎸</span>
        <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>
          {jam.sessionCode}
        </span>
        <button onClick={handleCopy} style={chipBtn}>
          {copied ? '✓' : t('jam_copy')}
        </button>
        {isJamaneger && (
          <button onClick={handleShare} style={chipBtn}>
            {t('share')}
          </button>
        )}
      </div>

      {/* ── Centre: now-playing + next ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
        {currentSong && (
          <span style={{
            fontSize: 12, opacity: 0.9,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            ♪ {currentSong.title}
          </span>
        )}
        {isJamaneger && (
          <button
            onClick={jam.playNext}
            title={t('jam_play_next')}
            style={{ ...chipBtn, flexShrink: 0 }}
          >
            {t('jam_play_next')} ▶
          </button>
        )}
      </div>

      {/* ── Right: count + role + actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span>👥 {jam.participantCount}</span>
        <span style={{ opacity: 0.85 }}>
          {isJamaneger ? t('jam_jamaneger_label') : t('jam_jamember_label')}
        </span>

        {/* Queue drawer toggle */}
        <button onClick={onOpenQueue} style={chipBtn}>
          {t('jam_queue_title')}
        </button>

        {/* Members panel (jamaneger only) */}
        {isJamaneger && (
          <button onClick={onOpenMembers} style={chipBtn}>
            {t('jam_members_title')}
          </button>
        )}

        {/* End / Leave */}
        <button
          onClick={handleLeaveOrEnd}
          disabled={leaving}
          style={{ ...chipBtn, fontWeight: 700, opacity: leaving ? 0.6 : 1 }}
        >
          {isJamaneger ? t('jam_end') : t('jam_leave')}
        </button>
      </div>
    </div>
  );
}

const chipBtn: React.CSSProperties = {
  background:   'rgba(255,255,255,0.2)',
  border:       'none',
  borderRadius: 4,
  color:        '#fff',
  fontSize:     11,
  fontWeight:   600,
  padding:      '2px 7px',
  cursor:       'pointer',
  whiteSpace:   'nowrap',
};
