import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SearchPage from '../pages/SearchPage';
import TunerPage from '../pages/TunerPage';
import TilePage from '../pages/TilePage';
import NowPlayingBar from './dashboard/NowPlayingBar';
import BottomNav from './dashboard/BottomNav';

// Page order: Tile (left) ← Search (center) → Tuner (right)
const PAGE_ORDER = ['/menu', '/search', '/tuner'] as const;

export default function SwipeableMain() {
  const location = useLocation();
  const navigate = useNavigate();

  const rawIdx = PAGE_ORDER.indexOf(location.pathname as typeof PAGE_ORDER[number]);
  const idx = rawIdx < 0 ? 1 : rawIdx; // default to search

  const [dragX,    setDragX]    = useState(0);
  const [dragging, setDragging] = useState(false);

  const startX      = useRef(0);
  const startIdx    = useRef(idx);
  const isDragging  = useRef(false); // ref for global event handlers (avoids stale closures)
  const idxRef      = useRef(idx);

  // Keep refs in sync with state
  useEffect(() => { idxRef.current = idx; }, [idx]);

  // ── Commit a drag gesture ──────────────────────────────────────────────
  const commitDrag = useCallback((endX: number) => {
    const delta = endX - startX.current;
    isDragging.current = false;
    setDragging(false);
    setDragX(0);
    if (delta < -60 && startIdx.current < 2) navigate(PAGE_ORDER[startIdx.current + 1]);
    else if (delta > 60 && startIdx.current > 0) navigate(PAGE_ORDER[startIdx.current - 1]);
  }, [navigate]);

  const updateDrag = useCallback((clientX: number) => {
    if (!isDragging.current) return;
    const delta = clientX - startX.current;
    if (startIdx.current === 0 && delta > 0) { setDragX(delta * 0.2); return; }
    if (startIdx.current === 2 && delta < 0) { setDragX(delta * 0.2); return; }
    setDragX(delta);
  }, []);

  // ── Touch handlers ─────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startIdx.current = idxRef.current;
    isDragging.current = true;
    setDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => updateDrag(e.touches[0].clientX);
  const handleTouchEnd  = (e: React.TouchEvent) => commitDrag(e.changedTouches[0].clientX);

  // ── Mouse handlers (desktop) ───────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    startIdx.current = idxRef.current;
    isDragging.current = true;
    setDragging(true);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => updateDrag(e.clientX);
    const onMouseUp   = (e: MouseEvent) => {
      if (!isDragging.current) return;
      commitDrag(e.clientX);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [updateDrag, commitDrag]);

  // ── Keyboard navigation (desktop) ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft'  && idxRef.current > 0) navigate(PAGE_ORDER[idxRef.current - 1]);
      if (e.key === 'ArrowRight' && idxRef.current < 2) navigate(PAGE_ORDER[idxRef.current + 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const onTuner = idx === 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── 3-panel swipeable track ──────────────────────────────────────── */}
      <div
        style={{
          flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div style={{
          display: 'flex',
          width: '300%',
          height: '100%',
          transform: `translateX(calc(${-idx * 100 / 3}% + ${dragX}px))`,
          transition: dragging ? 'none' : 'transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94)',
          willChange: 'transform',
        }}>
          {/* Panel 0 — Tile menu */}
          <div style={{ width: '33.333%', height: '100%', overflowY: 'auto', flexShrink: 0 }}>
            <TilePage />
          </div>
          {/* Panel 1 — Search/Home */}
          <div style={{ width: '33.333%', height: '100%', overflowY: 'auto', flexShrink: 0 }}>
            <SearchPage />
          </div>
          {/* Panel 2 — Tuner */}
          <div style={{ width: '33.333%', height: '100%', overflowY: 'auto', flexShrink: 0 }}>
            <TunerPage />
          </div>
        </div>

        {/* Page indicator dots */}
        <div style={{
          position: 'absolute', bottom: 10, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', gap: 6, pointerEvents: 'none', zIndex: 10,
        }}>
          {PAGE_ORDER.map((path, i) => (
            <div key={i} style={{
              width: i === idx ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === idx ? '#5B8DFF' : 'rgba(255,255,255,0.25)',
              transition: 'all 0.3s ease',
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
              onClick={() => navigate(path)}
            />
          ))}
        </div>
      </div>

      {/* Now Playing bar */}
      <NowPlayingBar />

      {/* Bottom nav — hidden on tuner */}
      {!onTuner && <BottomNav />}
    </div>
  );
}
