import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export default function SearchBar({ value, onChange, onSearch, isLoading }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div style={{ padding: '20px 20px 0' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 50,
        padding: '0 8px 0 20px',
        height: 56,
        boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Search icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search songs or artists..."
          style={{
            flex: 1,
            height: '100%',
            border: 'none',
            background: 'transparent',
            fontSize: 16,
            color: '#fff',
            outline: 'none',
          }}
        />

        {/* Mic button */}
        <button
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            transition: 'background 0.2s',
          }}
          title="Voice search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        {/* Tuner shortcut */}
        <button
          onClick={() => navigate('/tuner')}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, #5B8DFF, #A040FF)',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 2px 12px rgba(91,141,255,0.4)',
            transition: 'transform 0.15s',
          }}
          title="Tuner"
        >
          <span style={{ fontSize: 18 }}>🎸</span>
        </button>
      </div>
    </div>
  );
}
