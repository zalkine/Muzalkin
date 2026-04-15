/**
 * JamMemberList
 *
 * Modal showing all connected session members.
 * Jamanegers see kick + promote buttons per jamember.
 * Jamembers see a read-only list.
 */

import { useTranslation } from 'react-i18next';
import { useJam, type JamMember } from '../lib/jamContext';

type Props = {
  isOpen:  boolean;
  onClose: () => void;
  isRTL?:  boolean;
};

export default function JamMemberList({ isOpen, onClose, isRTL = false }: Props) {
  const { t } = useTranslation();
  const jam   = useJam();

  if (!isOpen || !jam.sessionCode) return null;

  const isJamaneger = jam.role === 'jamaneger';

  const handleKick = async (member: JamMember) => {
    if (!window.confirm(`Remove ${member.displayName} from the session?`)) return;
    await jam.kickMember(member.userId);
  };

  const handlePromote = async (member: JamMember) => {
    if (!window.confirm(`Promote ${member.displayName} to Jamaneger?`)) return;
    await jam.promoteMember(member.userId);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{ ...modalStyle, direction: isRTL ? 'rtl' : 'ltr' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>👥</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {t('jam_members_title')}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              backgroundColor: 'var(--accent)',
              color: '#fff', borderRadius: 10,
              padding: '1px 7px',
            }}>
              {jam.members.length}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Member rows */}
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {jam.members.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              {t('loading')}
            </p>
          ) : (
            jam.members.map(member => {
              const isMgr = member.role === 'jamaneger';
              return (
                <div
                  key={member.userId}
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    gap:           10,
                    padding:       '10px 0',
                    borderBottom:  '1px solid var(--border)',
                  }}
                >
                  {/* Avatar placeholder */}
                  <div style={{
                    width:           36,
                    height:          36,
                    borderRadius:    '50%',
                    backgroundColor: isMgr ? 'var(--accent)' : 'var(--surface)',
                    border:          '1px solid var(--border)',
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    fontSize:        16,
                    flexShrink:      0,
                  }}>
                    {isMgr ? '🎸' : '🎵'}
                  </div>

                  {/* Name + role badge */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.displayName || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: isMgr ? 'var(--accent)' : 'var(--text3)', marginTop: 1 }}>
                      {isMgr ? t('jam_jamaneger_label') : t('jam_jamember_label')}
                    </div>
                  </div>

                  {/* Jamaneger action buttons for jamembers */}
                  {isJamaneger && !isMgr && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => handlePromote(member)}
                        title={t('jam_promote_member')}
                        style={actionBtn}
                      >
                        ↑ {t('jam_promote_member')}
                      </button>
                      <button
                        onClick={() => handleKick(member)}
                        title={t('jam_remove_member')}
                        style={{ ...actionBtn, color: '#cc3333', borderColor: '#cc3333' }}
                      >
                        {t('jam_remove_member')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position:        'fixed',
  inset:           0,
  backgroundColor: 'rgba(0,0,0,0.45)',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         24,
  zIndex:          200,
};

const modalStyle: React.CSSProperties = {
  width:           '100%',
  maxWidth:        400,
  backgroundColor: 'var(--card-bg)',
  borderRadius:    14,
  padding:         '18px 16px',
  boxShadow:       '0 8px 32px rgba(0,0,0,0.2)',
};

const actionBtn: React.CSSProperties = {
  fontSize:     11,
  fontWeight:   600,
  padding:      '4px 8px',
  borderRadius: 5,
  border:       '1px solid var(--border)',
  background:   'var(--surface)',
  color:        'var(--text2)',
  cursor:       'pointer',
  whiteSpace:   'nowrap',
};
