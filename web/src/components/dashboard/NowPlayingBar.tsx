import { useJam } from '../../lib/jamContext';
import { useNavigate } from 'react-router-dom';

// Gradient palette for the artwork tile
const ART_GRADIENT = 'linear-gradient(135deg, #5B8DFF 0%, #A040FF 100%)';

interface NowPlayingBarProps {
  title?: string;
  artist?: string;
}

/**
 * Fixed mini-player shown above the bottom nav when a song/session is active.
 * Falls back to last-played mock data so the bar is always visible in the design.
 */
export default function NowPlayingBar({ title = 'Wonderwall', artist = 'Oasis' }: NowPlayingBarProps) {
  const jam = useJam();
  const navigate = useNavigate();

  const participantCount = jam.participantCount ?? 0;

  // Fake avatar colours for jam participants
  const avatarColors = ['#5B8DFF', '#A040FF', '#FF6B9D'];

  return (
    <div
      onClick={() => navigate('/search')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'rgba(18,18,42,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        cursor: 'pointer',
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
        width: 42,
        height: 42,
        borderRadius: 10,
        background: ART_GRADIENT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        flexShrink: 0,
        boxShadow: '0 4px 16px rgba(91,141,255,0.35)',
      }}>
        🎸
      </div>

      {/* Title + artist */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          {artist}
        </p>
      </div>

      {/* Participant avatars (shown when jam active) */}
      {participantCount > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {avatarColors.slice(0, Math.min(participantCount, 3)).map((color, i) => (
            <div key={i} style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: color,
              border: '2px solid #12122a',
              marginLeft: i > 0 ? -8 : 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
            }}>
              👤
            </div>
          ))}
        </div>
      ) : (
        /* Play/pause icon */
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(91,141,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
      )}
    </div>
  );
}
