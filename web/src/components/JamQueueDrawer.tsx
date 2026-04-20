/**
 * JamQueueDrawer
 *
 * Slide-up drawer wrapping JamQueueContent.
 * Used from the JamBanner when the user is on any page other than /jam.
 * On /jam itself, JamPage renders JamQueueContent inline.
 */

import { useJam }        from '../lib/jamContext';
import JamQueueContent   from './JamQueueContent';

type Props = {
  isOpen:  boolean;
  onClose: () => void;
  isRTL?:  boolean;
};

export default function JamQueueDrawer({ isOpen, onClose, isRTL = false }: Props) {
  const jam = useJam();
  if (!jam.sessionCode) return null;

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 150 }}
        />
      )}

      <div style={{
        position:        'fixed',
        bottom:          0,
        left:            0,
        right:           0,
        maxHeight:       '78vh',
        backgroundColor: 'var(--card-bg)',
        borderRadius:    '16px 16px 0 0',
        boxShadow:       '0 -4px 24px rgba(0,0,0,0.2)',
        zIndex:          160,
        display:         'flex',
        flexDirection:   'column',
        transform:       isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition:      'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <JamQueueContent isRTL={isRTL} onClose={onClose} />
      </div>
    </>
  );
}
