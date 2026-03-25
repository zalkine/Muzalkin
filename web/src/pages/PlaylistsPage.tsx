import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/SessionContext';

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  song_count: number;
};

type Status = 'loading' | 'done' | 'error';

export default function PlaylistsPage() {
  const { t, i18n } = useTranslation();
  const isRTL   = i18n.language === 'he';
  const session = useSession();
  const navigate = useNavigate();

  if (!session) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, padding: 24 }}>
        <span style={{ fontSize: 48 }}>🎵</span>
        <p style={{ fontSize: 16, color: '#555', textAlign: 'center' }}>{t('sign_in_to_see_playlists')}</p>
        <button
          onClick={() => navigate('/login')}
          style={{ padding: '10px 24px', backgroundColor: '#4285F4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
        >
          {t('sign_in_google')}
        </button>
      </div>
    );
  }

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [status,    setStatus]    = useState<Status>('loading');
  const [showModal, setShowModal] = useState(false);
  const [newName,   setNewName]   = useState('');
  const [creating,  setCreating]  = useState(false);

  const loadPlaylists = useCallback(async () => {
    setStatus('loading');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus('error'); return; }

    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, description, is_public, created_at, playlist_songs(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) { setStatus('error'); return; }

    const mapped: Playlist[] = (data ?? []).map((p: any) => ({
      id:          p.id,
      name:        p.name,
      description: p.description,
      is_public:   p.is_public,
      created_at:  p.created_at,
      song_count:  p.playlist_songs?.[0]?.count ?? 0,
    }));

    setPlaylists(mapped);
    setStatus('done');
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { error } = await supabase.from('playlists').insert({
      user_id:   user.id,
      name:      newName.trim(),
      is_public: false,
    });

    setCreating(false);
    setShowModal(false);
    setNewName('');

    if (error) { alert(t('save_error')); } else { loadPlaylists(); }
  }, [newName, loadPlaylists, t]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid #e0e0e0',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>
          {t('my_playlists')}
        </h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: '#4285F4', border: 'none',
            color: '#fff', fontSize: 22, lineHeight: '36px',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {status === 'loading' && (
          <div style={centerStyle}>
            <div style={spinnerStyle} />
          </div>
        )}

        {status === 'error' && (
          <div style={centerStyle}>
            <p style={{ color: '#cc3333' }}>{t('error_load')}</p>
            <button onClick={loadPlaylists} style={linkBtnStyle}>{t('retry')}</button>
          </div>
        )}

        {status === 'done' && playlists.length === 0 && (
          <div style={centerStyle}>
            <p style={{ color: '#888', textAlign: 'center' }}>{t('no_playlists')}</p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                paddingInline: 20, paddingBlock: 10,
                backgroundColor: '#4285F4', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 15,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t('create_playlist')}
            </button>
          </div>
        )}

        {status === 'done' && playlists.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {playlists.map((pl, idx) => (
              <li key={pl.id} style={{
                display: 'flex',
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                padding: '14px 16px',
                borderBottom: idx < playlists.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}>
                <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{pl.name}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>
                    {t(pl.song_count === 1 ? 'songs_count_one' : 'songs_count_other', {
                      count: pl.song_count,
                    })}
                  </div>
                </div>
                <span style={{ fontSize: 18, color: '#bbb' }}>{isRTL ? '‹' : '›'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create playlist modal */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: 0, textAlign: isRTL ? 'right' : 'left' }}>{t('new_playlist')}</h3>
            <input
              type="text"
              placeholder={t('playlist_name')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              dir={isRTL ? 'rtl' : 'ltr'}
              style={{
                height: 44, border: '1px solid #ddd', borderRadius: 8,
                paddingInline: 12, fontSize: 16, outline: 'none',
                textAlign: isRTL ? 'right' : 'left',
              }}
            />
            <div style={{
              display: 'flex',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'flex-end',
              gap: 10,
            }}>
              <button
                onClick={() => { setShowModal(false); setNewName(''); }}
                style={{
                  paddingInline: 14, paddingBlock: 8,
                  border: '1px solid #ddd', borderRadius: 8,
                  background: '#fff', fontSize: 14, cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                style={{
                  paddingInline: 14, paddingBlock: 8,
                  backgroundColor: (!newName.trim() || creating) ? '#aaa' : '#4285F4',
                  border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {creating ? '...' : t('create')}
              </button>
            </div>
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
  border: '3px solid #e0e0e0', borderTopColor: '#4285F4',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#4285F4',
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 32, zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 400, backgroundColor: '#fff',
  borderRadius: 12, padding: 20, display: 'flex',
  flexDirection: 'column', gap: 16,
};
