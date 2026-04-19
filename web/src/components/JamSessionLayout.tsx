/**
 * JamSessionLayout — Full-screen overlay that locks the app into jam mode.
 * Rendered in App.tsx whenever jam.sessionCode is set.
 * Managers get playback controls; participants get a read-only view.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJam }         from '../lib/jamContext';
import { useSession }     from '../lib/SessionContext';
import { supabase }       from '../lib/supabase';
import ChordDisplay, { ChordLine } from './ChordDisplay';
import { normalizeChordData }      from '../utils/chords';
import JamQueueDrawer              from './JamQueueDrawer';
import JamMemberList               from './JamMemberList';

// ── Transpose helpers (mirrored from SongDetailPage) ──────────────────────────

const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENHARMONIC: Record<string,string> = { Db:'C#',Eb:'D#',Gb:'F#',Ab:'G#',Bb:'A#' };

function transposeNote(note: string, semi: number): string {
  const n = ENHARMONIC[note] ?? note;
  const i = CHROMATIC.indexOf(n);
  return i === -1 ? note : CHROMATIC[(i + semi + 12) % 12];
}

const CHORD_RE = /[A-G][#b]?(m|maj|min|sus[24]?|dim|aug|add\d+|[0-9])*(?:\/[A-G][#b]?)?/g;

function transposeLine(content: string, semi: number): string {
  if (semi === 0) return content;
  return content.replace(CHORD_RE, (match) => {
    const slash = match.indexOf('/');
    if (slash !== -1) {
      const root = match.slice(0, slash); const bass = match.slice(slash + 1);
      const rn = root.match(/^[A-G][#b]?/)?.[0] ?? ''; const bn = bass.match(/^[A-G][#b]?/)?.[0] ?? '';
      return `${transposeNote(rn, semi)}${root.slice(rn.length)}/${transposeNote(bn, semi)}`;
    }
    const rn = match.match(/^[A-G][#b]?/)?.[0] ?? '';
    return `${transposeNote(rn, semi)}${match.slice(rn.length)}`;
  });
}

function applyTranspose(data: ChordLine[], semi: number): ChordLine[] {
  if (semi === 0) return data;
  return data.map(line => {
    if (line.type === 'chords') return { ...line, content: transposeLine(line.content, semi) };
    if (line.type === 'line')   return { ...line, segments: line.segments.map(s => ({ ...s, chord: s.chord ? transposeLine(s.chord, semi) : s.chord })) };
    return line;
  });
}

const SCROLL_SPEEDS = [0.2, 0.4, 0.6, 0.9, 1.4];

// ── Icons ─────────────────────────────────────────────────────────────────────

const Ic = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// ── Main component ─────────────────────────────────────────────────────────────

export default function JamSessionLayout() {
  const jam      = useJam();
  const session  = useSession();
  const { t, i18n } = useTranslation();
  const isRTL    = i18n.language === 'he';
  const isManager = jam.role === 'jamaneger';

  // Song data
  const [chordsData, setChordsData] = useState<ChordLine[] | null>(null);
  const [songTitle,  setSongTitle]  = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [loading,    setLoading]    = useState(false);

  // Local scroll state
  const scrollRef    = useRef<HTMLDivElement>(null);
  const scrollOffset = useRef(0);
  const scrollTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrolling,  setScrolling]  = useState(false);
  const [speedIndex, setSpeedIndex] = useState(jam.speedIndex);

  // Local semitones (follows jam.semitones)
  const [semitones, setSemitones] = useState(jam.semitones);

  // Drawers
  const [queueOpen,   setQueueOpen]   = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [codeCopied,  setCodeCopied]  = useState(false);

  // ── Load chord data when current queue item changes ────────────────────────
  useEffect(() => {
    if (!jam.currentQueueItemId) { setChordsData(null); setSongTitle(''); setSongArtist(''); return; }
    const item = jam.queue.find(q => q.id === jam.currentQueueItemId);
    if (!item || !item.songId) return;

    setSongTitle(item.title);
    setSongArtist(item.artist);
    setLoading(true);

    supabase
      .from('cached_chords')
      .select('song_title, artist, chords_data')
      .eq('id', item.songId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSongTitle(data.song_title ?? item.title);
          setSongArtist(data.artist   ?? item.artist);
          setChordsData(data.chords_data as ChordLine[]);
        }
        setLoading(false);
      });
  }, [jam.currentQueueItemId, jam.queue]);

  // ── Sync semitones from context (participant follows manager) ──────────────
  useEffect(() => { setSemitones(jam.semitones); }, [jam.semitones]);

  // ── Sync speed from context ────────────────────────────────────────────────
  useEffect(() => { setSpeedIndex(jam.speedIndex); }, [jam.speedIndex]);

  // ── Scroll sync: receive position from manager (participant) ───────────────
  useEffect(() => {
    if (isManager) return;
    return jam.onScrollSync(pos => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = pos;
        scrollOffset.current = pos;
      }
    });
  }, [isManager, jam]);

  // ── Auto-scroll ticker (manager) ───────────────────────────────────────────
  const stopScroll = useCallback(() => {
    if (scrollTimer.current) { clearInterval(scrollTimer.current); scrollTimer.current = null; }
    setScrolling(false);
  }, []);

  const startScroll = useCallback(() => {
    if (scrollTimer.current) clearInterval(scrollTimer.current);
    scrollTimer.current = setInterval(() => {
      if (!scrollRef.current) return;
      scrollOffset.current += SCROLL_SPEEDS[speedIndex];
      scrollRef.current.scrollTop = scrollOffset.current;
      jam.broadcastScroll(scrollOffset.current);
    }, 50);
    setScrolling(true);
  }, [speedIndex, jam]);

  const toggleScroll = useCallback(() => {
    if (scrolling) stopScroll(); else startScroll();
  }, [scrolling, stopScroll, startScroll]);

  // Restart scroll timer when speed changes while scrolling
  useEffect(() => {
    if (scrolling) startScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedIndex]);

  useEffect(() => () => { if (scrollTimer.current) clearInterval(scrollTimer.current); }, []);

  // ── Manager: transpose ─────────────────────────────────────────────────────
  const changeTranspose = (delta: number) => {
    const next = semitones + delta;
    setSemitones(next);
    jam.broadcastTranspose(next);
  };

  // ── Manager: speed ─────────────────────────────────────────────────────────
  const changeSpeed = (delta: number) => {
    const next = Math.max(0, Math.min(SCROLL_SPEEDS.length - 1, speedIndex + delta));
    setSpeedIndex(next);
    jam.broadcastSpeed(next);
  };

  // ── Restart song (scroll to top, broadcast) ────────────────────────────────
  const restart = () => {
    scrollOffset.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    jam.broadcastScroll(0);
  };

  // ── Copy session code ──────────────────────────────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(jam.sessionCode ?? '').catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  };

  // ── Chord display data ─────────────────────────────────────────────────────
  const displayData = chordsData
    ? normalizeChordData(applyTranspose(chordsData, semitones), isRTL)
    : null;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const iconBtn = (color = '#fff', bg = 'rgba(255,255,255,0.08)'): React.CSSProperties => ({
    width: 42, height: 42, borderRadius: 12,
    background: bg, border: '1px solid rgba(255,255,255,0.12)',
    color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, fontSize: 13, fontWeight: 700,
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#0c0c1a',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: 'rgba(12,12,26,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        {/* Live badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)',
          borderRadius: 20, padding: '3px 10px', flexShrink: 0,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF5050', boxShadow: '0 0 5px #FF5050' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#FF5050', letterSpacing: 0.8 }}>LIVE</span>
        </div>

        {/* Song title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {songTitle ? (
            <>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{songTitle}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{songArtist}</p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              {isRTL ? 'ג׳אם סשן' : 'Jam Session'} · {jam.sessionCode}
            </p>
          )}
        </div>

        {/* Members count */}
        <button onClick={() => setMembersOpen(true)} style={{ ...iconBtn(), gap: 4, width: 'auto', padding: '0 10px' }}>
          <span style={{ fontSize: 13 }}>👥</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{jam.participantCount}</span>
        </button>

        {/* Queue */}
        <button onClick={() => setQueueOpen(true)} style={iconBtn()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </button>

        {/* End/Leave */}
        <button
          onClick={isManager ? () => jam.endSession() : () => jam.leaveSession()}
          style={iconBtn('#FF6060', 'rgba(255,60,60,0.1)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── CHORD DISPLAY ───────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', position: 'relative' }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Empty / no song selected */}
        {!jam.currentQueueItemId && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '60vh', gap: 20, textAlign: 'center',
          }}>
            {/* Session code */}
            <div style={{
              background: 'rgba(91,141,255,0.08)', border: '1.5px solid rgba(91,141,255,0.25)',
              borderRadius: 16, padding: '16px 28px',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
                {isRTL ? 'קוד ג׳אם' : 'Jam Code'}
              </p>
              <button onClick={copyCode} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: '0.22em', color: codeCopied ? '#5B8DFF' : '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  {jam.sessionCode}
                </span>
              </button>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                {codeCopied ? (isRTL ? 'הועתק!' : 'Copied!') : (isRTL ? 'לחץ להעתקה' : 'Tap to copy')}
              </p>
            </div>

            {/* Member count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              <span style={{ fontSize: 20 }}>👥</span>
              <span>{jam.participantCount} {isRTL ? 'מוזיקאים מחוברים' : 'musicians connected'}</span>
            </div>

            {/* Pick a song prompt */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 16px', fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>
                {isManager
                  ? (isRTL ? 'בחר שיר להתחיל את הג׳אם' : 'Pick a song to start the jam')
                  : (isRTL ? 'הממנג׳ר יבחר שיר בקרוב...' : 'Waiting for manager to pick a song…')}
              </p>
              {isManager && (
                <button onClick={() => setQueueOpen(true)} style={{
                  height: 46, paddingInline: 28, borderRadius: 12,
                  background: 'linear-gradient(90deg, #5B8DFF, #A040FF)',
                  border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 4px 20px rgba(91,141,255,0.4)',
                }}>
                  {isRTL ? '🎵 פתח תור שירים' : '🎵 Open Queue'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {jam.currentQueueItemId && loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#5B8DFF', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* Chord display */}
        {displayData && !loading && (
          <ChordDisplay data={displayData} fontSize={1.2} isRTL={isRTL} showTabs={false} />
        )}
      </div>

      {/* ── MANAGER CONTROLS ────────────────────────────────────────────────── */}
      {isManager && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(12,12,26,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          {/* Previous */}
          <button onClick={() => jam.playPrevious()} title={isRTL ? 'שיר קודם' : 'Previous'} style={iconBtn()}>
            <Ic d="M19 20L9 12l10-8v16M5 19V5" size={18} />
          </button>

          {/* Restart */}
          <button onClick={restart} title={isRTL ? 'התחל מחדש' : 'Restart'} style={iconBtn()}>
            <Ic d="M1 4v6h6M3.51 15a9 9 0 1 0 .49-3.5" size={18} />
          </button>

          {/* Next */}
          <button onClick={() => jam.playNext()} title={isRTL ? 'שיר הבא' : 'Next'} style={iconBtn()}>
            <Ic d="M5 4l10 8-10 8V4M19 5v14" size={18} />
          </button>

          <div style={{ flex: 1 }} />

          {/* Scroll toggle */}
          <button
            onClick={toggleScroll}
            style={iconBtn(scrolling ? '#5B8DFF' : '#fff', scrolling ? 'rgba(91,141,255,0.2)' : 'rgba(255,255,255,0.08)')}
            title={isRTL ? 'גלילה אוטומטית' : 'Auto-scroll'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {scrolling
                ? <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
                : <polygon points="5,3 19,12 5,21"/>}
            </svg>
          </button>

          {/* Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => changeSpeed(-1)} disabled={speedIndex === 0}
              style={{ ...iconBtn(), width: 28, height: 28, opacity: speedIndex === 0 ? 0.35 : 1 }}>−</button>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', width: 30, textAlign: 'center' }}>
              ×{SCROLL_SPEEDS[speedIndex].toFixed(1)}
            </span>
            <button onClick={() => changeSpeed(1)} disabled={speedIndex === SCROLL_SPEEDS.length - 1}
              style={{ ...iconBtn(), width: 28, height: 28, opacity: speedIndex === SCROLL_SPEEDS.length - 1 ? 0.35 : 1 }}>+</button>
          </div>

          <div style={{ flex: 1 }} />

          {/* Transpose */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => changeTranspose(-1)} style={{ ...iconBtn(), width: 28, height: 28 }}>♭</button>
            <span style={{ fontSize: 11, color: semitones === 0 ? 'rgba(255,255,255,0.35)' : '#5B8DFF', width: 26, textAlign: 'center', fontWeight: 700 }}>
              {semitones === 0 ? '0' : semitones > 0 ? `+${semitones}` : semitones}
            </span>
            <button onClick={() => changeTranspose(1)} style={{ ...iconBtn(), width: 28, height: 28 }}>♯</button>
          </div>
        </div>
      )}

      {/* ── PARTICIPANT BOTTOM BAR ───────────────────────────────────────────── */}
      {!isManager && (
        <div style={{
          padding: '10px 16px', background: 'rgba(12,12,26,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {isRTL ? 'קצב:' : 'Key:'} {semitones === 0 ? '—' : semitones > 0 ? `+${semitones}` : semitones}
            </span>
          </div>
          <button
            onClick={() => jam.leaveSession()}
            style={{ height: 36, paddingInline: 20, borderRadius: 10, background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.2)', color: '#FF6060', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {isRTL ? 'עזוב ג׳אם' : 'Leave Jam'}
          </button>
        </div>
      )}

      {/* ── DRAWERS ─────────────────────────────────────────────────────────── */}
      <JamQueueDrawer isOpen={queueOpen} onClose={() => setQueueOpen(false)} isRTL={isRTL} />
      <JamMemberList  isOpen={membersOpen} onClose={() => setMembersOpen(false)} isRTL={isRTL} />
    </div>
  );
}
