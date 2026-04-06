import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/SessionContext';

type PlaylistSong = {
  id: string;         // playlist_songs.id
  position: number;
  song: {
    id: string;
    title: string;
    artist: string;
    language: string;
    instrument: string;
  };
};

type Playlist = { id: string; name: string; description: string | null };
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

  const load = useCallback(async () => {
    if (!id || !session) return;
    setStatus('loading');

    const [plRes, songsRes] = await Promise.all([
      supabase
        .from('playlists')
        .select('id, name, description')
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

                {/* Remove button */}
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
              </li>
            ))}
          </ul>
        )}
      </div>
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
