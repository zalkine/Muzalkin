/**
 * JamPage  —  /jam
 *
 * The dedicated jam session hub.
 *
 * NOT in session:
 *   Two cards — Start a Jam (logged-in only) and Join a Jam.
 *
 * IN session:
 *   Full jam environment: session header, now-playing card,
 *   inline queue + add-songs panel.
 *   This is the primary screen while a session is active.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation }    from 'react-router-dom';
import { useTranslation }              from 'react-i18next';
import { useJam }                      from '../lib/jamContext';
import { useSession }                  from '../lib/SessionContext';
import { supabase }                    from '../lib/supabase';
import JamQueueContent                 from '../components/JamQueueContent';
import JamMemberList                   from '../components/JamMemberList';

const GUEST_NICKNAMES = [
  'Rhythm Rider', 'Groove Maker', 'Soul Groover', 'Beat Rider',
  'Vibe Player',  'Voice Star',   'Soul Singer',  'Rapper', 'Stage Beast',
];
function randomGuestName() {
  return GUEST_NICKNAMES[Math.floor(Math.random() * GUEST_NICKNAMES.length)];
}

export default function JamPage() {
  const { t, i18n } = useTranslation();
  const navigate     = useNavigate();
  const location     = useLocation();
  const jam          = useJam();
  const session      = useSession();
  const isRTL        = i18n.language === 'he';

  // ── Shared state ───────────────────────────────────────────────────────────
  const [nickname,      setNickname]      = useState('');
  const [isLoggedIn,    setIsLoggedIn]    = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [leaving,       setLeaving]       = useState(false);

  // ── Join form state ────────────────────────────────────────────────────────
  const [joinCode,   setJoinCode]   = useState('');
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'error'>('idle');
  const nicknameRef                  = useRef<HTMLInputElement>(null);

  // ── Start form state ───────────────────────────────────────────────────────
  const [startStatus, setStartStatus] = useState<'idle' | 'starting'>('idle');

  // Auto-navigate non-leads to the current song when they land on /jam
  // (unless they explicitly came back via the "🎸 Back to Session" button)
  useEffect(() => {
    if (!jam.sessionCode || jam.isLead) return;
    const fromJam = (location.state as { fromJam?: boolean } | null)?.fromJam;
    if (fromJam) return;
    if (!jam.currentQueueItemId) return;
    const current = jam.queue.find(q => q.id === jam.currentQueueItemId);
    if (current) navigate(`/song/${current.songId}`, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jam.sessionCode, jam.isLead]);

  // Detect auth + pre-fill nickname
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsLoggedIn(true);
        setNickname(user.user_metadata?.full_name ?? user.email ?? '');
      } else {
        setIsLoggedIn(false);
        setNickname(randomGuestName());
      }
    });
  }, [session]);

  // ── Session actions ────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!nickname.trim()) return;
    setStartStatus('starting');
    await jam.startSession();    // no initial song — queue starts empty
    setStartStatus('idle');
  };

  const handleJoin = async (preferredRole: 'jamaneger' | 'jamember' = 'jamember') => {
    const clean = joinCode.toUpperCase().trim();
    if (clean.length !== 6) { setJoinStatus('error'); return; }
    if (!nickname.trim()) { nicknameRef.current?.focus(); return; }
    setJoinStatus('joining');
    const result = await jam.joinSession(clean, nickname.trim(), preferredRole);
    if (!result) { setJoinStatus('error'); return; }
    setJoinStatus('idle');
    // page re-renders automatically because jam.sessionCode is now set
  };

  const handleCopy = () => {
    const url = `${window.location.origin}/jam/${jam.sessionCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    const url = `${window.location.origin}/jam/${jam.sessionCode}`;
    if (navigator.share) {
      navigator.share({ title: t('jam_share_title'), text: t('jam_share_text', { code: jam.sessionCode }), url }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const handleLeaveOrEnd = async () => {
    setLeaving(true);
    if (jam.role === 'jamaneger') {
      await jam.endSession();
    } else {
      jam.leaveSession();
    }
    setLeaving(false);
  };

  // ── Current song from queue ────────────────────────────────────────────────
  const currentSong = jam.queue.find(q => q.id === jam.currentQueueItemId);

  // ══════════════════════════════════════════════════════════════════════════
  // IN SESSION — hub view
  // ══════════════════════════════════════════════════════════════════════════
  if (jam.sessionCode) {
    const isJamaneger = jam.role === 'jamaneger';
    const roleLabel   = jam.isLead
      ? t('jam_lead_label')
      : (isJamaneger ? t('jam_jamaneger_label') : t('jam_jamember_label'));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)', direction: isRTL ? 'rtl' : 'ltr' }}>

        {/* ── Session header ── */}
        <div style={{
          backgroundColor: 'var(--accent)',
          color: '#fff',
          padding: '12px 16px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {/* Row 1: code + copy + share */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>🎸</span>
            <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '0.15em' }}>
              {jam.sessionCode}
            </span>
            <button onClick={handleCopy} style={chipBtn}>
              {copied ? '✓' : t('jam_copy')}
            </button>
            <button onClick={handleShare} style={chipBtn}>{t('share')}</button>
            <span style={{ marginInlineStart: 'auto', fontSize: 13, opacity: 0.9 }}>
              👥 {jam.participantCount} · {roleLabel}
            </span>
          </div>

          {/* Row 2: actions + leader-offline warning */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Leader offline banner */}
            {!jam.isLeadOnline && !jam.isLead && (
              <span style={{
                fontSize: 12, padding: '3px 8px',
                backgroundColor: 'rgba(0,0,0,0.25)',
                borderRadius: 5, whiteSpace: 'nowrap',
              }}>
                ⚠️ Leader offline
                {isJamaneger ? ' — tap Take Control to lead' : ' — waiting for them to reconnect'}
              </span>
            )}
            {isJamaneger && !jam.isLead && (
              <button
                onClick={jam.takeLead}
                style={{ ...chipBtn, backgroundColor: 'rgba(255,255,255,0.35)', fontWeight: 800 }}
              >
                🎸 {t('jam_take_lead')}
              </button>
            )}
            {isJamaneger && (
              <button onClick={() => setIsMembersOpen(true)} style={chipBtn}>
                {t('jam_members_title')}
              </button>
            )}
            <button
              onClick={handleLeaveOrEnd}
              disabled={leaving}
              style={{ ...chipBtn, fontWeight: 700, opacity: leaving ? 0.6 : 1, marginInlineStart: isJamaneger ? 'auto' : undefined }}
            >
              {isJamaneger ? t('jam_end') : t('jam_leave')}
            </button>
          </div>
        </div>

        {/* ── Now playing card ── */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          flexShrink: 0,
        }}>
          {currentSong ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  ♪ {t('jam_now_playing')}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentSong.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                  {currentSong.artist}
                </div>
              </div>
              <button
                onClick={() => navigate(`/song/${currentSong.songId}`)}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('jam_view_chords')} →
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text3)', fontSize: 14 }}>
              🎶 {t('jam_no_current_song')}
            </div>
          )}
        </div>

        {/* ── Queue / Add Songs (inline) ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <JamQueueContent isRTL={isRTL} />
        </div>

        {/* Members overlay */}
        <JamMemberList
          isOpen={isMembersOpen}
          onClose={() => setIsMembersOpen(false)}
          isRTL={isRTL}
        />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOT IN SESSION — Start / Join cards
  // ══════════════════════════════════════════════════════════════════════════
  const canJoin = joinCode.length === 6 && nickname.trim().length > 0 && joinStatus !== 'joining';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '28px 20px 40px',
      gap: 20,
      overflowY: 'auto',
      height: '100%',
      direction: isRTL ? 'rtl' : 'ltr',
    }}>
      <span style={{ fontSize: 52 }}>🎸</span>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>
        {t('jam_nav')}
      </h1>

      {/* ── Shared nickname ── */}
      <div style={{ width: '100%', maxWidth: 360 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
          {t('jam_nickname_label')}
        </label>
        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value.slice(0, 30))}
          placeholder={t('jam_nickname_placeholder')}
          maxLength={30}
          style={{
            width: '100%', height: 46, border: '1px solid var(--border)',
            borderRadius: 10, paddingInline: 14, fontSize: 15,
            boxSizing: 'border-box', backgroundColor: 'var(--input-bg)',
            color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      {/* ── Start Jam card (logged-in only) ── */}
      {isLoggedIn && (
        <div style={cardStyle}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🚀</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
            {t('jam_start_title')}
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
            {t('jam_start_hint')}
          </p>
          <button
            onClick={handleStart}
            disabled={startStatus === 'starting' || !nickname.trim()}
            style={{
              width: '100%', height: 48,
              backgroundColor: nickname.trim() && startStatus === 'idle' ? 'var(--accent)' : '#aaa',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {startStatus === 'starting' ? t('loading') : t('jam_start_btn')}
          </button>
        </div>
      )}

      {/* ── Join Jam card ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>🎵</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
          {t('jam_join_title')}
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
          {t('jam_join_hint')}
        </p>

        {/* Code input */}
        <input
          type="text"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="ABC123"
          maxLength={6}
          style={{
            width: '100%', height: 56,
            border: `2px solid ${joinStatus === 'error' ? '#cc3333' : 'var(--border)'}`,
            borderRadius: 10, paddingInline: 14,
            fontSize: 28, fontWeight: 800, letterSpacing: '0.2em',
            textAlign: 'center', textTransform: 'uppercase',
            backgroundColor: 'var(--input-bg)', color: 'var(--text)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {joinStatus === 'error' && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#cc3333', textAlign: 'center' }}>
            {t('jam_not_found')}
          </p>
        )}

        {/* Role choice — logged-in users; guests are always jamember */}
        {isLoggedIn ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 14, width: '100%' }}>
            <button
              onClick={() => handleJoin('jamaneger')}
              disabled={!canJoin}
              style={{
                flex: 1, height: 48,
                backgroundColor: canJoin ? 'var(--accent)' : '#aaa',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: canJoin ? 'pointer' : 'default',
                lineHeight: 1.3,
              }}
            >
              {joinStatus === 'joining' ? '…' : t('jam_join_as_manager')}
            </button>
            <button
              onClick={() => handleJoin('jamember')}
              disabled={!canJoin}
              style={{
                flex: 1, height: 48,
                backgroundColor: 'var(--surface)',
                color: canJoin ? 'var(--accent)' : '#aaa',
                border: `1px solid ${canJoin ? 'var(--accent)' : '#aaa'}`,
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: canJoin ? 'pointer' : 'default', lineHeight: 1.3,
              }}
            >
              {joinStatus === 'joining' ? '…' : t('jam_join_as_jamember')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleJoin()}
            disabled={!canJoin}
            style={{
              marginTop: 14, width: '100%', height: 48,
              backgroundColor: canJoin ? 'var(--accent)' : '#aaa',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 16, fontWeight: 700, cursor: canJoin ? 'pointer' : 'default',
            }}
          >
            {joinStatus === 'joining' ? t('loading') : t('jam_join_btn')}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const chipBtn: React.CSSProperties = {
  background:   'rgba(255,255,255,0.2)',
  border:       'none',
  borderRadius: 4,
  color:        '#fff',
  fontSize:     11,
  fontWeight:   600,
  padding:      '3px 9px',
  cursor:       'pointer',
  whiteSpace:   'nowrap',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 360,
  backgroundColor: 'var(--card-bg)',
  borderRadius: 16,
  padding: '20px 20px 18px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  border: '1px solid var(--border)',
};
