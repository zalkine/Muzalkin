import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/SessionContext';

const BACKEND_URL = '';

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  song_count: number;
  creator_name: string;
  is_owner: boolean;
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
        <p style={{ fontSize: 16, color: 'var(--text2)', textAlign: 'center' }}>{t('sign_in_to_see_playlists')}</p>
        <button
          onClick={() => navigate('/login')}
          style={{ padding: '10px 24px', backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
        >
          {t('sign_in_google')}
        </button>
      </div>
    );
  }

  const [playlists,  setPlaylists]  = useState<Playlist[]>([]);
  const [status,     setStatus]     = useState<Status>('loading');
  const [showModal,  setShowModal]  = useState(false);
  const [newName,    setNewName]    = useState('');
  const [creating,   setCreating]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');

  const getToken = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token ?? '';
  };

  const loadPlaylists = useCallback(async () => {
    setStatus('loading');
    const token = await getToken();
    if (!token) { setStatus('error'); return; }

    try {
      const res = await fetch(`${BACKEND_URL}/api/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setStatus('error'); return; }
      setPlaylists(await res.json());
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const token = await getToken();
    if (!token) { setCreating(false); return; }

    const res = await fetch(`${BACKEND_URL}/api/playlists`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });

    setCreating(false);
    setShowModal(false);
    setNewName('');
    if (!res.ok) { alert(t('save_error')); } else { loadPlaylists(); }
  }, [newName, loadPlaylists, t]);

  const handleRename = useCallback(async (id: string, name: string) => {
    setEditingId(null);
    if (!name.trim()) return;
    const token = await getToken();
    if (!token) return;

    const res = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name: name.trim() } : p));
    }
  }, []);

  const handleTogglePublic = useCallback(async (id: string, current: boolean) => {
    const token = await getToken();
    if (!token) return;

    const res = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !current }),
    });
    if (res.ok) {
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, is_public: !current } : p));
    }
  }, []);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!window.confirm(t('delete_playlist_confirm', { name }))) return;
    const token = await getToken();
    if (!token) return;

    const res = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setPlaylists(prev => prev.filter(p => p.id !== id));
    }
  }, [t]);

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const myPlaylists     = playlists.filter(p => p.is_owner);
  const publicPlaylists = playlists.filter(p => !p.is_owner);

  const renderRow = (pl: Playlist, idx: number, arr: Playlist[]) => (
    <li
      key={pl.id}
      style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: idx < arr.length - 1 ? '1px solid var(--border2)' : 'none',
        gap: 10,
      }}
    >
      {/* Info area — navigates to detail except when editing */}
      <div
        style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
        onClick={() => editingId !== pl.id && navigate(`/playlist/${pl.id}`)}
      >
        {/* Name + badge row */}
        <div style={{
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: 2,
        }}>
          {editingId === pl.id ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename(pl.id, editName);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onBlur={() => handleRename(pl.id, editName)}
              onClick={e => e.stopPropagation()}
              dir={isRTL ? 'rtl' : 'ltr'}
              style={{
                fontSize: 15, fontWeight: 600, color: 'var(--text)',
                border: '1px solid var(--accent)', borderRadius: 6,
                padding: '2px 8px', background: 'var(--input-bg)',
                outline: 'none', flex: 1, maxWidth: 220,
              }}
            />
          ) : (
            <span style={{
              fontSize: 15, fontWeight: 600, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {pl.name}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, paddingInline: 5, paddingBlock: 2,
            borderRadius: 4, flexShrink: 0,
            backgroundColor: pl.is_public ? 'rgba(66,133,244,0.12)' : 'rgba(150,150,150,0.12)',
            color: pl.is_public ? 'var(--accent)' : 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: 0.3,
          }}>
            {pl.is_public ? t('public_badge') : t('private_badge')}
          </span>
        </div>
        {/* Subtitle row */}
        <div style={{
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 4, alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {t('by_creator', { name: pl.creator_name })}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {t(pl.song_count === 1 ? 'songs_count_one' : 'songs_count_other', { count: pl.song_count })}
          </span>
        </div>
      </div>

      {/* Owner controls */}
      {pl.is_owner ? (
        <div style={{
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 4, flexShrink: 0,
        }}>
          <button
            title={pl.is_public ? t('make_private') : t('make_public')}
            onClick={e => { e.stopPropagation(); handleTogglePublic(pl.id, pl.is_public); }}
            style={ctrlBtnStyle}
          >
            {pl.is_public ? '🔒' : '🌐'}
          </button>
          <button
            title={t('rename_playlist')}
            onClick={e => { e.stopPropagation(); startEdit(pl.id, pl.name); }}
            style={ctrlBtnStyle}
          >
            ✏
          </button>
          <button
            title={t('delete_playlist')}
            onClick={e => { e.stopPropagation(); handleDelete(pl.id, pl.name); }}
            style={{ ...ctrlBtnStyle, color: '#e53e3e' }}
          >
            🗑
          </button>
        </div>
      ) : (
        <span style={{ fontSize: 18, color: 'var(--text3)', flexShrink: 0 }}>
          {isRTL ? '‹' : '›'}
        </span>
      )}
    </li>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg)',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          {t('playlists')}
        </h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'var(--accent)', border: 'none',
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
          <div style={centerStyle}><div style={spinnerStyle} /></div>
        )}

        {status === 'error' && (
          <div style={centerStyle}>
            <p style={{ color: '#cc3333' }}>{t('error_load')}</p>
            <button onClick={loadPlaylists} style={linkBtnStyle}>{t('retry')}</button>
          </div>
        )}

        {status === 'done' && (
          <>
            {/* My Playlists section */}
            <div style={{ padding: '10px 16px 4px' }}>
              <span style={sectionLabelStyle}>{t('my_playlists')}</span>
            </div>

            {myPlaylists.length === 0 ? (
              <div style={{ padding: '8px 16px 12px' }}>
                <button
                  onClick={() => setShowModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  + {t('create_playlist')}
                </button>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
                {myPlaylists.map((pl, idx) => renderRow(pl, idx, myPlaylists))}
              </ul>
            )}

            {/* Public Playlists section */}
            {publicPlaylists.length > 0 && (
              <>
                <div style={{ padding: '10px 16px 4px', borderTop: '1px solid var(--border)' }}>
                  <span style={sectionLabelStyle}>{t('public_playlists')}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {publicPlaylists.map((pl, idx) => renderRow(pl, idx, publicPlaylists))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {/* Create playlist modal */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, backgroundColor: 'var(--card-bg)' }}>
            <h3 style={{ margin: 0, textAlign: isRTL ? 'right' : 'left', color: 'var(--text)' }}>
              {t('new_playlist')}
            </h3>
            <input
              type="text"
              placeholder={t('playlist_name')}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
              dir={isRTL ? 'rtl' : 'ltr'}
              style={{
                height: 44, border: '1px solid var(--border)', borderRadius: 8,
                paddingInline: 12, fontSize: 16, outline: 'none',
                backgroundColor: 'var(--input-bg)', color: 'var(--text)',
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
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--bg)', color: 'var(--text)', fontSize: 14, cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                style={{
                  paddingInline: 14, paddingBlock: 8,
                  backgroundColor: (!newName.trim() || creating) ? '#aaa' : 'var(--accent)',
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
  border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--accent)',
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 32, zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 400,
  borderRadius: 12, padding: 20, display: 'flex',
  flexDirection: 'column', gap: 16,
};

const ctrlBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '3px 7px',
  fontSize: 14,
  cursor: 'pointer',
  color: 'var(--text3)',
  lineHeight: 1.4,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: 0.8,
};
