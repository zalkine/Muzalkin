/**
 * JoinJamPage — /jam/:code
 *
 * Handles direct-link joins (e.g. someone opens muzalkin.app/jam/ABC123).
 * Also used as the manual "Join Jam" entry screen when code is typed in.
 *
 * Guests (not logged in) get a random nickname pre-filled.
 * Logged-in users get their Google display name pre-filled.
 * The nickname is always editable before joining.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams }       from 'react-router-dom';
import { useTranslation }               from 'react-i18next';
import { useJam }                       from '../lib/jamContext';
import { supabase }                     from '../lib/supabase';

const GUEST_NICKNAMES = [
  'Rhythm Rider', 'Groove Maker', 'Soul Groover', 'Beat Rider',
  'Vibe Player',  'Voice Star',   'Soul Singer',  'Rapper', 'Stage Beast',
];

function randomGuestName(): string {
  return GUEST_NICKNAMES[Math.floor(Math.random() * GUEST_NICKNAMES.length)];
}

export default function JoinJamPage() {
  const { code: urlCode } = useParams<{ code?: string }>();
  const { t, i18n }       = useTranslation();
  const navigate          = useNavigate();
  const jam               = useJam();
  const isRTL             = i18n.language === 'he';

  const [inputCode, setInputCode] = useState(urlCode?.toUpperCase() ?? '');
  const [nickname,  setNickname]  = useState('');
  const [status,    setStatus]    = useState<'idle' | 'joining' | 'error'>('idle');
  const nicknameRef               = useRef<HTMLInputElement>(null);

  // Pre-fill nickname: Google name for logged-in users, random name for guests
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setNickname(user.user_metadata?.full_name ?? user.email ?? '');
      } else {
        setNickname(randomGuestName());
      }
    });
  }, []);

  // If code came from URL, focus the nickname field so user just hits Enter
  useEffect(() => {
    if (urlCode && nicknameRef.current) {
      nicknameRef.current.focus();
      nicknameRef.current.select();
    }
  }, [urlCode]);

  async function handleJoin(code = inputCode) {
    const clean = code.toUpperCase().trim();
    if (clean.length !== 6) { setStatus('error'); return; }
    if (!nickname.trim())   { nicknameRef.current?.focus(); return; }

    setStatus('joining');
    const songRef = await jam.joinSession(clean, nickname.trim());
    if (!songRef) {
      setStatus('error');
      return;
    }

    if (songRef.songId) {
      navigate(`/song/${songRef.songId}`, { replace: true });
    } else {
      navigate('/search', { replace: true });
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: 32,
      direction: isRTL ? 'rtl' : 'ltr',
    }}>
      <span style={{ fontSize: 48, marginBottom: 16 }}>🎸</span>

      <h2 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text)', textAlign: 'center' }}>
        {t('jam_join_title')}
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--text2)', textAlign: 'center' }}>
        {t('jam_join_hint')}
      </p>

      {/* Jam code input */}
      <input
        type="text"
        value={inputCode}
        onChange={e => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
        placeholder="ABC123"
        maxLength={6}
        autoFocus={!urlCode}
        style={{
          width: '100%', maxWidth: 240, height: 56,
          border: `2px solid ${status === 'error' ? '#cc3333' : 'var(--border)'}`,
          borderRadius: 10, paddingInline: 16,
          fontSize: 28, fontWeight: 800, letterSpacing: '0.2em',
          textAlign: 'center', textTransform: 'uppercase',
          backgroundColor: 'var(--input-bg)', color: 'var(--text)',
          outline: 'none',
        }}
      />

      {/* Nickname input */}
      <div style={{ width: '100%', maxWidth: 240, marginTop: 14 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4, textAlign: 'center' }}>
          {t('jam_nickname_label')}
        </label>
        <input
          ref={nicknameRef}
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value.slice(0, 30))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder={t('jam_nickname_placeholder')}
          maxLength={30}
          style={{
            width: '100%', height: 44,
            border: '1px solid var(--border)',
            borderRadius: 10, paddingInline: 16,
            fontSize: 15, boxSizing: 'border-box',
            backgroundColor: 'var(--input-bg)', color: 'var(--text)',
            outline: 'none', textAlign: 'center',
          }}
        />
      </div>

      {status === 'error' && (
        <p style={{ marginTop: 10, fontSize: 13, color: '#cc3333', textAlign: 'center' }}>
          {t('jam_not_found')}
        </p>
      )}

      <button
        onClick={() => handleJoin()}
        disabled={status === 'joining' || inputCode.length !== 6 || !nickname.trim()}
        style={{
          marginTop: 20, width: '100%', maxWidth: 240, height: 48,
          backgroundColor:
            status === 'joining' || inputCode.length !== 6 || !nickname.trim()
              ? '#aaa'
              : 'var(--accent)',
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {status === 'joining' ? t('loading') : t('jam_join_btn')}
      </button>

      <button
        onClick={() => navigate(-1)}
        style={{
          marginTop: 12, background: 'none', border: 'none',
          color: 'var(--text3)', fontSize: 14, cursor: 'pointer',
        }}
      >
        {t('cancel')}
      </button>
    </div>
  );
}
