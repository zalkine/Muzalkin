import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJam } from '../../lib/jamContext';

// ── localStorage helpers ───────────────────────────────────────────────────
export const LAST_PLAYED_KEY = 'muzalkin_last_played';

export type LastPlayed = { title: string; artist: string; id?: string };

export function saveLastPlayed(info: LastPlayed) {
  try { localStorage.setItem(LAST_PLAYED_KEY, JSON.stringify(info)); } catch {}
  // Notify other components on the same page
  window.dispatchEvent(new Event('muzalkin_last_played'));
}

function readLastPlayed(): LastPlayed | null {
  try {
    const raw = localStorage.getItem(LAST_PLAYED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastPlayed;
  } catch { return null; }
}

// ── Component ──────────────────────────────────────────────────────────────
const ART_GRADIENT = 'linear-gradient(135deg, #5B8DFF 0%, #A040FF 100%)';

export default function NowPlayingBar() {
  const jam      = useJam();
  const navigate = useNavigate();

  const [song,      setSong]      = useState<LastPlayed | null>(() => readLastPlayed());
  const [dismissed, setDismissed] = useState(false);

  // Re-read whenever another component saves a new last-played song
  useEffect(() => {
    const refresh = () => { setSong(readLastPlayed()); setDismissed(false); };
    window.addEventListener('muzalkin_last_played', refresh);
    return () => window.removeEventListener('muzalkin_last_played', refresh);
  }, []);

  // Nothing to show
  if (!song || dismissed) return null;

  const participantCount = jam.participantCount ?? 0;
  const avatarColors = ['#5B8DFF', '#A040FF', '#FF6B9D'];

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  };

  const handleClick = () => {
    if (song.id) navigate(`/song/${song.id}`);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'rgba(18,18,42,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        cursor: song.id ? 'pointer' : 'default',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Progress bar along the very top edge */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0,
        height: 2,
        width: '45%',
        background: 'linear-gradient(90deg, #5B8DFF, #A040FF)',
        borderRadius: 1,
      }} />

      {/* Artwork */}
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: ART_GRADIENT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
        boxShadow: '0 4px 16px rgba(91,141,255,0.35)',
      }}>
        🎸
      </div>

      {/* Title + artist */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {song.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          {song.artist}
        </p>
      </div>

      {/* Participant avatars (shown when jam active) */}
      {participantCount > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {avatarColors.slice(0, Math.min(participantCount, 3)).map((color, i) => (
            <div key={i} style={{
              width: 26, height: 26, borderRadius: '50%',
              background: color,
              border: '2px solid #12122a',
              marginLeft: i > 0 ? -8 : 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11,
            }}>
              👤
            </div>
          ))}
        </div>
      ) : (
        /* Play icon */
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(91,141,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
      )}

      {/* Dismiss × */}
      <button
        onClick={handleDismiss}
        title="Dismiss"
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, cursor: 'pointer', flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
