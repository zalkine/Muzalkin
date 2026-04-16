import { useNavigate } from 'react-router-dom';
import type { JamSession } from './types';

interface JamStatusCardProps {
  jam: JamSession;
}

export default function JamStatusCard({ jam }: JamStatusCardProps) {
  const navigate = useNavigate();
  if (!jam.active) return null;

  return (
    <div style={{
      margin: '16px 20px 0',
      borderRadius: 18,
      padding: '14px 16px',
      background: 'rgba(91,141,255,0.08)',
      border: '1px solid rgba(91,141,255,0.3)',
      boxShadow: '0 0 30px rgba(91,141,255,0.12), inset 0 0 30px rgba(91,141,255,0.04)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      {/* Animated guitar artwork */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #5B8DFF, #A040FF)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          boxShadow: '0 4px 20px rgba(91,141,255,0.4)',
        }}>
          🎸
        </div>
        {/* Live dot */}
        <span style={{
          position: 'absolute',
          top: -3,
          right: -3,
          width: 11,
          height: 11,
          background: '#4ade80',
          borderRadius: '50%',
          border: '2px solid #0c0c1a',
          animation: 'jam-pulse 1.4s ease-in-out infinite',
        }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#5B8DFF',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}>
            Live Jam:
          </span>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            background: 'rgba(91,141,255,0.2)',
            padding: '1px 8px',
            borderRadius: 20,
            fontFamily: 'monospace',
            letterSpacing: 1,
          }}>
            {jam.code}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            ({jam.participants} players)
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: '60%',
            background: 'linear-gradient(90deg, #5B8DFF, #A040FF)',
            borderRadius: 2,
          }} />
        </div>
      </div>

      {/* Rejoin button */}
      <button
        onClick={() => navigate(`/jam/${jam.code}`)}
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #5B8DFF, #A040FF)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(91,141,255,0.4)',
          fontSize: 18,
        }}
      >
        🎸
      </button>
    </div>
  );
}
