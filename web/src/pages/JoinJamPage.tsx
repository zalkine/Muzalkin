import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams }       from 'react-router-dom';
import { useTranslation }               from 'react-i18next';
import { useJam }                       from '../lib/jamContext';
import { useSession }                   from '../lib/SessionContext';
import { signInWithGoogle }             from '../lib/supabase';

// ── Small helpers ──────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}

// ── Active session card ────────────────────────────────────────────────────────

function ActiveSession({
  code, role, isRTL, onEnd, onLeave,
}: { code: string; role: string | null; isRTL: boolean; onEnd: () => void; onLeave: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = () => {
    const text = t('jam_share_text', { code });
    if (navigator.share) {
      navigator.share({ title: 'MuZalkin Jam', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const isManager = role === 'jamaneger';

  return (
    <div style={{ width: '100%', maxWidth: 320 }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Live badge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,80,80,0.15)',
          border: '1px solid rgba(255,80,80,0.35)',
          borderRadius: 20, padding: '5px 14px',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#FF5050',
            boxShadow: '0 0 6px #FF5050', animation: 'pulse 1.6s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#FF5050', letterSpacing: 1 }}>
            {isManager ? t('jam_jamaneger_label') : t('jam_jamember_label')}
          </span>
        </div>
      </div>

      {/* Code display */}
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>
        {t('jam_code_label')}
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(91,141,255,0.1)',
        border: '1.5px solid rgba(91,141,255,0.35)',
        borderRadius: 16, padding: '14px 20px', marginBottom: 12,
        gap: 16,
      }}>
        <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '0.25em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {code}
        </span>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
        {t('jam_code_hint')}
      </p>

      {/* Share buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <button onClick={copy} style={{
          flex: 1, height: 42, borderRadius: 12,
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          color: copied ? '#5B8DFF' : 'rgba(255,255,255,0.7)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          transition: 'color 0.2s',
        }}>
          <CopyIcon />
          {copied ? t('jam_copied') : t('jam_copy')}
        </button>
        <button onClick={share} style={{
          flex: 1, height: 42, borderRadius: 12,
          background: 'rgba(91,141,255,0.12)', border: '1px solid rgba(91,141,255,0.25)',
          color: '#5B8DFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <ShareIcon />
          {t('jam_copy_link')}
        </button>
      </div>

      {/* End / Leave */}
      <button
        onClick={isManager ? onEnd : onLeave}
        style={{
          width: '100%', height: 46, borderRadius: 12,
          background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.25)',
          color: '#FF6060', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {isManager ? t('jam_end') : t('jam_leave')}
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function JoinJamPage() {
  const { code: urlCode }   = useParams<{ code?: string }>();
  const { t, i18n }         = useTranslation();
  const navigate            = useNavigate();
  const jam                 = useJam();
  const session             = useSession();
  const isRTL               = i18n.language === 'he';
  const isLoggedIn          = !!session;

  const [inputCode,   setInputCode]   = useState(urlCode?.toUpperCase() ?? '');
  const [joinStatus,  setJoinStatus]  = useState<'idle' | 'joining' | 'error'>('idle');
  const [starting,    setStarting]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-join if code was in URL
  useEffect(() => {
    if (urlCode) handleJoin(urlCode.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleJoin(code = inputCode) {
    const clean = code.toUpperCase().trim();
    if (clean.length !== 6) { setJoinStatus('error'); return; }
    setJoinStatus('joining');
    const songRef = await jam.joinSession(clean);
    if (!songRef) { setJoinStatus('error'); return; }
    if (songRef.songId) {
      navigate(`/song/${songRef.songId}`, { replace: true });
    } else {
      navigate('/search', { replace: true });
    }
  }

  async function handleStart() {
    setStarting(true);
    // Start with an empty placeholder — manager will pick a song via search
    const code = await jam.startSession({
      songId: '', source: 'cached', title: '', artist: '',
    });
    setStarting(false);
    if (!code) {
      alert('Failed to start jam. Please try again.');
    }
    // Code is now set on jam.sessionCode — the active session view renders automatically
  }

  function handleGoogleLogin() {
    // Store return path so AuthCallback redirects back here after login
    sessionStorage.setItem('auth_return', '/jam');
    signInWithGoogle();
  }

  // ── Active session view ─────────────────────────────────────────────────────
  if (jam.sessionCode) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100%', padding: '32px 24px',
        background: '#0c0c1a',
      }}>
        <ActiveSession
          code={jam.sessionCode}
          role={jam.role}
          isRTL={isRTL}
          onEnd={async () => { await jam.endSession(); }}
          onLeave={() => jam.leaveSession()}
        />
      </div>
    );
  }

  // ── Idle view ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100%', padding: '40px 24px 32px',
      background: '#0c0c1a',
      direction: isRTL ? 'rtl' : 'ltr',
    }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎸</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#fff' }}>
          {isRTL ? 'ג׳אם סשן' : 'Jam Session'}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
          {isRTL ? 'נגנו יחד בזמן אמת' : 'Play together in real time'}
        </p>
      </div>

      {/* ── Start a Jam ─────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'rgba(91,141,255,0.08)',
        border: '1px solid rgba(91,141,255,0.2)',
        borderRadius: 20, padding: '24px 20px', marginBottom: 20,
      }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#fff' }}>
          {isRTL ? 'פתח ג׳אם' : 'Start a Jam'}
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          {isRTL ? 'צור קוד ושתף עם חברים' : 'Create a code and invite your friends'}
        </p>

        {isLoggedIn ? (
          <button
            onClick={handleStart}
            disabled={starting}
            style={{
              width: '100%', height: 48, borderRadius: 12,
              background: starting
                ? 'rgba(91,141,255,0.3)'
                : 'linear-gradient(90deg, #5B8DFF, #A040FF)',
              border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: starting ? 'default' : 'pointer',
              boxShadow: starting ? 'none' : '0 4px 20px rgba(91,141,255,0.4)',
              transition: 'all 0.2s',
            }}
          >
            {starting
              ? (isRTL ? 'יוצר...' : 'Creating…')
              : (isRTL ? 'התחל ג׳אם' : 'Start Jam')}
          </button>
        ) : (
          <button
            onClick={handleGoogleLogin}
            style={{
              width: '100%', height: 48, borderRadius: 12,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {/* Google G icon */}
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            {isRTL ? 'התחבר עם גוגל כדי לפתוח ג׳אם' : 'Login with Google to start a Jam'}
          </button>
        )}
      </div>

      {/* ── Join a Jam ──────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 20, padding: '24px 20px',
      }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#fff' }}>
          {isRTL ? 'הצטרף לג׳אם' : 'Join a Jam'}
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          {isRTL ? 'הכנס קוד ג׳אם שקיבלת' : 'Enter the jam code you received'}
        </p>

        <input
          ref={inputRef}
          type="text"
          value={inputCode}
          onChange={e => {
            setJoinStatus('idle');
            setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
          }}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="ABC123"
          maxLength={6}
          dir="ltr"
          style={{
            width: '100%', height: 54, boxSizing: 'border-box',
            border: `2px solid ${joinStatus === 'error' ? '#cc3333' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 12, paddingInline: 16,
            fontSize: 28, fontWeight: 900, letterSpacing: '0.2em',
            textAlign: 'center', textTransform: 'uppercase',
            background: 'rgba(255,255,255,0.05)', color: '#fff',
            outline: 'none', transition: 'border-color 0.2s',
          }}
        />

        {joinStatus === 'error' && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#cc3333', textAlign: 'center' }}>
            {t('jam_not_found')}
          </p>
        )}

        <button
          onClick={() => handleJoin()}
          disabled={joinStatus === 'joining' || inputCode.length !== 6}
          style={{
            marginTop: 14, width: '100%', height: 48, borderRadius: 12,
            background: (joinStatus === 'joining' || inputCode.length !== 6)
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: inputCode.length !== 6 ? 'rgba(255,255,255,0.3)' : '#fff',
            fontSize: 15, fontWeight: 700,
            cursor: (joinStatus === 'joining' || inputCode.length !== 6) ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {joinStatus === 'joining'
            ? (isRTL ? 'מצטרף...' : 'Joining…')
            : (isRTL ? 'הצטרף' : 'Join')}
        </button>
      </div>

    </div>
  );
}
