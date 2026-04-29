import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/SessionContext';

const BACKEND_URL = '';

type PlaylistSong = {
  id: string;
  position: number;
  song: {
    id: string;
    title: string;
    artist: string;
    language: string;
    instrument: string;
  };
};

type Playlist = { id: string; name: string; description: string | null; user_id: string };
type OwnPlaylist = { id: string; name: string };
type Status = 'loading' | 'done' | 'error';

export default function PlaylistDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const { t, i18n } = useTranslation();
  const isRTL       = i18n.language === 'he';
  const session     = useSession();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs,    setSongs]    = useState<PlaylistSong[]>([]);
  const [status,   setStatus]   = useState<Status>('loading');

  const isOwner = playlist?.user_id === session?.user.id;

  // Copy-to-playlist state
  const [showCopyModal,  setShowCopyModal]  = useState(false);
  const [ownPlaylists,   setOwnPlaylists]   = useState<OwnPlaylist[]>([]);
  const [loadingOwn,     setLoadingOwn]     = useState(false);
  const [copying,        setCopying]        = useState(false);
  const [copyMsg,        setCopyMsg]        = useState<string | null>(null);

  const getToken = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token ?? '';
  };

  const load = useCallback(async () => {
    if (!id || !session) return;
    setStatus('loading');

    const [plRes, songsRes] = await Promise.all([
      supabase
        .from('playlists')
        .select('id, name, description, user_id')
        .eq('id', id)
        .single(),
      supabase
        .from('playlist_songs')
        .select('id, position, song:song_id(id, title, artist, language, instrument)')
        .eq('playlist_id', id)
        .order('position', { ascending: true }),
    ]);

    if (plRes.error || !plRes.data) { setStatus('error'); return; }

    setPlaylist(plRes.data as Playlist);
    setSongs((songsRes.data ?? []) as unknown as PlaylistSong[]);
    setStatus('done');
  }, [id, session]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = useCallback(async (playlistSongId: string) => {
    const { error } = await supabase
      .from('playlist_songs')
      .delete()
      .eq('id', playlistSongId);
    if (!error) setSongs(prev => prev.filter(s => s.id !== playlistSongId));
  }, []);

  const openCopyModal = useCallback(async () => {
    setShowCopyModal(true);
    setCopyMsg(null);
    setLoadingOwn(true);
    const token = await getToken();
    if (!token) { setLoadingOwn(false); return; }

    try {
      const res = await fetch(`${BACKEND_URL}/api/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Only show playlists the user owns and that are not the source playlist
      setOwnPlaylists((data as any[]).filter(p => p.is_owner && p.id !== id));
    } finally {
      setLoadingOwn(false);
    }
  }, [id]);

  const handleCopy = useCallback(async (targetId: string) => {
    setCopying(true);
    setCopyMsg(null);
    const token = await getToken();
    if (!token) { setCopying(false); return; }

    try {
      const res = await fetch(`${BACKEND_URL}/api/playlists/${id}/copy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_playlist_id: targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCopyMsg(t('copy_error'));
      } else if (data.copied === 0) {
        setCopyMsg(t('copy_nothing'));
      } else {
        setCopyMsg(t('copy_success', { count: data.copied }));
      }
    } catch {
      setCopyMsg(t('copy_error'));
    } finally {
      setCopying(false);
    }
  }, [id, t]);

  if (!session) {
    return (
      <div style={centerStyle}>
        <p style={{ color: 'var(--text3)' }}>{t('sign_in_to_see_playlists')}</p>
        <button onClick={() => navigate('/login')} style={accentBtnStyle}>{t('sign_in_google')}</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        gap: 8,
      }}>
        <button onClick={() => navigate('/playlists')} style={iconBtnStyle}>
          {isRTL ? '→' : '←'}
        </button>
        <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {playlist?.name ?? '…'}
          </div>
          {playlist?.description && (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{playlist.description}</div>
          )}
        </div>
        {/* Copy to playlist button */}
        {status === 'done' && (
          <button
            onClick={openCopyModal}
            title={t('copy_to_playlist')}
            style={{
              ...iconBtnStyle,
              fontSize: 13, fontWeight: 600,
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              padding: '5px 10px',
            }}
          >
            {t('copy_to_playlist')}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {status === 'loading' && (
          <div style={centerStyle}><div style={spinnerStyle} /></div>
        )}

        {status === 'error' && (
          <div style={centerStyle}>
            <p style={{ color: '#cc3333' }}>{t('error_load')}</p>
            <button onClick={load} style={linkBtnStyle}>{t('retry')}</button>
          </div>
        )}

        {status === 'done' && songs.length === 0 && (
          <div style={centerStyle}>
            <p style={{ color: 'var(--text3)', textAlign: 'center' }}>{t('playlist_empty')}</p>
            <button onClick={() => navigate('/search')} style={accentBtnStyle}>{t('search')}</button>
          </div>
        )}

        {status === 'done' && songs.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {songs.map((ps, idx) => (
              <li key={ps.id} style={{
                display: 'flex',
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                borderBottom: idx < songs.length - 1 ? '1px solid var(--border2)' : 'none',
              }}>
                <button
                  onClick={() => navigate(`/song/${ps.song.id}`)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    padding: '14px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: isRTL ? 'right' : 'left',
                    cursor: 'pointer',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {ps.song.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>{ps.song.artist}</div>
                  </div>
                  <span style={{ fontSize: 18, color: 'var(--text3)' }}>{isRTL ? '‹' : '›'}</span>
                </button>

                {/* Remove button — owner only */}
                {isOwner && (
                  <button
                    onClick={() => handleRemove(ps.id)}
                    title={t('remove')}
                    style={{
                      padding: '14px 14px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text3)',
                      fontSize: 18,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Copy to playlist modal */}
      {showCopyModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, backgroundColor: 'var(--card-bg)' }}>
            <div style={{
              display: 'flex',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, color: 'var(--text)', textAlign: isRTL ? 'right' : 'left' }}>
                {t('copy_to_playlist')}
              </h3>
              <button
                onClick={() => { setShowCopyModal(false); setCopyMsg(null); }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}
              >
                ✕
              </button>
            </div>

            {copyMsg && (
              <p style={{
                margin: 0,
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: copyMsg === t('copy_error') ? 'rgba(204,51,51,0.1)' : 'rgba(66,133,244,0.1)',
                color: copyMsg === t('copy_error') ? '#cc3333' : 'var(--accent)',
                fontSize: 14,
                textAlign: isRTL ? 'right' : 'left',
              }}>
                {copyMsg}
              </p>
            )}

            {loadingOwn && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                <div style={spinnerStyle} />
              </div>
            )}

            {!loadingOwn && ownPlaylists.length === 0 && !copyMsg && (
              <p style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', margin: 0 }}>
                {t('no_playlists')}
              </p>
            )}

            {!loadingOwn && ownPlaylists.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 260, overflowY: 'auto' }}>
                {ownPlaylists.map((pl, idx) => (
                  <li key={pl.id}>
                    <button
                      onClick={() => !copying && handleCopy(pl.id)}
                      disabled={copying}
                      style={{
                        width: '100%',
                        textAlign: isRTL ? 'right' : 'left',
                        padding: '11px 14px',
                        background: 'none',
                        border: 'none',
                        borderBottom: idx < ownPlaylists.length - 1 ? '1px solid var(--border2)' : 'none',
                        cursor: copying ? 'not-allowed' : 'pointer',
                        fontSize: 15,
                        color: copying ? 'var(--text3)' : 'var(--text)',
                        fontWeight: 500,
                      }}
                    >
                      {pl.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {copying && (
              <p style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', margin: 0 }}>
                {t('copying')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', height: '60vh', gap: 14, padding: 32,
};

const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 22, color: 'var(--accent)', padding: 4,
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--accent)',
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const accentBtnStyle: React.CSSProperties = {
  padding: '10px 24px', backgroundColor: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer', fontWeight: 600,
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 32, zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 400,
  borderRadius: 12, padding: 20, display: 'flex',
  flexDirection: 'column', gap: 14,
};
