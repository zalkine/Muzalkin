/**
 * JamQueueDrawer
 *
 * Slide-up panel showing the jam session song queue.
 *
 * Jamaneger view: reorder (▲▼), remove (✕), tap to play, Next button.
 * Jamember view:  read-only list, current song highlighted, Add to Queue button.
 *
 * Both roles can add songs (from search — handled in SearchPage).
 * Renders null when no session is active.
 */

import { useTranslation } from 'react-i18next';
import { useJam, type QueueItem } from '../lib/jamContext';

type Props = {
  isOpen:  boolean;
  onClose: () => void;
  isRTL?:  boolean;
};

export default function JamQueueDrawer({ isOpen, onClose, isRTL = false }: Props) {
  const { t } = useTranslation();
  const jam   = useJam();

  if (!jam.sessionCode) return null;

  const isJamaneger = jam.role === 'jamaneger';
  const sorted = [...jam.queue].sort((a, b) => a.position - b.position);

  const moveItem = (item: QueueItem, dir: -1 | 1) => {
    const idx     = sorted.findIndex(q => q.id === item.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    jam.reorderQueue(reordered.map(q => q.id));
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 150,
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position:        'fixed',
        bottom:          0,
        left:            0,
        right:           0,
        maxHeight:       '70vh',
        backgroundColor: 'var(--card-bg)',
        borderRadius:    '16px 16px 0 0',
        boxShadow:       '0 -4px 24px rgba(0,0,0,0.2)',
        zIndex:          160,
        display:         'flex',
        flexDirection:   'column',
        transform:       isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition:      'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
        direction:       isRTL ? 'rtl' : 'ltr',
      }}>
        {/* Handle + header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '12px 16px 8px',
          borderBottom:   '1px solid var(--border)',
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎵</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {t('jam_queue_title')}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              backgroundColor: 'var(--accent)',
              color: '#fff', borderRadius: 10,
              padding: '1px 7px',
            }}>
              {sorted.length}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Queue list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text3)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎶</div>
              <p style={{ margin: 0, fontSize: 14 }}>{t('jam_queue_empty')}</p>
            </div>
          ) : (
            sorted.map((item, idx) => {
              const isCurrent = item.id === jam.currentQueueItemId;
              return (
                <div
                  key={item.id}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             8,
                    padding:         '10px 16px',
                    backgroundColor: isCurrent ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    borderLeft:      isCurrent ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                >
                  {/* Position number */}
                  <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 20, textAlign: 'center' }}>
                    {isCurrent ? '▶' : idx + 1}
                  </span>

                  {/* Song info — tap to play (jamaneger only) */}
                  <div
                    style={{ flex: 1, minWidth: 0, cursor: isJamaneger ? 'pointer' : 'default' }}
                    onClick={() => isJamaneger && jam.selectSong(item.id)}
                  >
                    <div style={{
                      fontSize: 14, fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? 'var(--accent)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>
                      {item.artist}
                    </div>
                  </div>

                  {/* Jamaneger controls: reorder + remove */}
                  {isJamaneger && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => moveItem(item, -1)}
                        disabled={idx === 0}
                        style={{ ...iconBtn, opacity: idx === 0 ? 0.3 : 1 }}
                        title="Move up"
                      >▲</button>
                      <button
                        onClick={() => moveItem(item, 1)}
                        disabled={idx === sorted.length - 1}
                        style={{ ...iconBtn, opacity: idx === sorted.length - 1 ? 0.3 : 1 }}
                        title="Move down"
                      >▼</button>
                      <button
                        onClick={() => jam.removeFromQueue(item.id)}
                        style={{ ...iconBtn, color: '#cc3333' }}
                        title={t('jam_queue_remove')}
                      >✕</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Next button for jamaneger */}
        {isJamaneger && (
          <div style={{
            padding:      '10px 16px',
            borderTop:    '1px solid var(--border)',
            flexShrink:   0,
          }}>
            <button
              onClick={() => { jam.playNext(); onClose(); }}
              style={{
                width:           '100%',
                padding:         '10px',
                backgroundColor: 'var(--accent)',
                color:           '#fff',
                border:          'none',
                borderRadius:    8,
                fontSize:        14,
                fontWeight:      700,
                cursor:          'pointer',
              }}
            >
              {t('jam_play_next')} ▶
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const iconBtn: React.CSSProperties = {
  width:           28,
  height:          28,
  border:          '1px solid var(--border)',
  borderRadius:    5,
  background:      'var(--surface)',
  color:           'var(--text2)',
  fontSize:        12,
  cursor:          'pointer',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         0,
};
