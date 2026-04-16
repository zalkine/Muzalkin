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
  const navigate  = useNavigate();

  const rawIdx = PAGE_ORDER.indexOf(location.pathname as typeof PAGE_ORDER[number]);
  const idx    = rawIdx < 0 ? 1 : rawIdx; // default to search (center)

  const [dragX,    setDragX]    = useState(0);
  const [dragging, setDragging] = useState(false);

  const startX     = useRef(0);
  const startIdx   = useRef(idx);
  const isDragging = useRef(false);
  const idxRef     = useRef(idx);

  useEffect(() => { idxRef.current = idx; }, [idx]);

  // ── Shared drag logic ──────────────────────────────────────────────────
  const updateDrag = useCallback((clientX: number) => {
    if (!isDragging.current) return;
    const delta = clientX - startX.current;
    if (startIdx.current === 0 && delta > 0) { setDragX(delta * 0.2); return; }
    if (startIdx.current === 2 && delta < 0) { setDragX(delta * 0.2); return; }
    setDragX(delta);
  }, []);

  const commitDrag = useCallback((clientX: number) => {
    if (!isDragging.current) return;
    const delta = clientX - startX.current;
    isDragging.current = false;
    setDragging(false);
    setDragX(0);
    if (delta < -60 && startIdx.current < 2) navigate(PAGE_ORDER[startIdx.current + 1]);
    else if (delta > 60 && startIdx.current > 0) navigate(PAGE_ORDER[startIdx.current - 1]);
  }, [navigate]);

  const beginDrag = useCallback((clientX: number) => {
    startX.current    = clientX;
    startIdx.current  = idxRef.current;
    isDragging.current = true;
    setDragging(true);
  }, []);

  // ── Touch ─────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => beginDrag(e.touches[0].clientX);
  const onTouchMove  = (e: React.TouchEvent) => updateDrag(e.touches[0].clientX);
  const onTouchEnd   = (e: React.TouchEvent) => commitDrag(e.changedTouches[0].clientX);

  // ── Mouse (desktop) — window-level to catch mouseup outside element ───
  const onMouseDown  = (e: React.MouseEvent) => beginDrag(e.clientX);
  useEffect(() => {
    const mv = (e: MouseEvent) => updateDrag(e.clientX);
    const mu = (e: MouseEvent) => commitDrag(e.clientX);
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup',   mu);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', mu); };
  }, [updateDrag, commitDrag]);

  // ── Keyboard (desktop) ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft'  && idxRef.current > 0) navigate(PAGE_ORDER[idxRef.current - 1]);
      if (e.key === 'ArrowRight' && idxRef.current < 2) navigate(PAGE_ORDER[idxRef.current + 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const onTuner = idx === 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Track container ───────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        {/*
          IMPORTANT: position:absolute + top/bottom:0 guarantees the track
          height always equals the container height. Using height:'100%' on
          a flex-1 child can silently resolve to 0 in some browsers.
        */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          width: '300%',
          display: 'flex',
          transform: `translateX(calc(${-idx * 100 / 3}% + ${dragX}px))`,
          transition: dragging ? 'none' : 'transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94)',
          willChange: 'transform',
        }}>
          <div style={{ flex: '0 0 33.333%', height: '100%', overflowY: 'auto' }}>
            <TilePage />
          </div>
          <div style={{ flex: '0 0 33.333%', height: '100%', overflowY: 'auto' }}>
            <SearchPage />
          </div>
          <div style={{ flex: '0 0 33.333%', height: '100%', overflowY: 'auto' }}>
            <TunerPage />
          </div>
        </div>

        {/* Page indicator dots — also clickable */}
        <div style={{
          position: 'absolute', bottom: 10, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', gap: 6, zIndex: 10, pointerEvents: 'none',
        }}>
          {PAGE_ORDER.map((path, i) => (
            <div
              key={i}
              onClick={() => navigate(path)}
              style={{
                width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                background: i === idx ? '#5B8DFF' : 'rgba(255,255,255,0.25)',
                transition: 'all 0.3s ease',
                pointerEvents: 'auto', cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      {/* Now Playing bar */}
      <NowPlayingBar />

      {/* Bottom nav — hidden on tuner page */}
      {!onTuner && <BottomNav />}
    </div>
  );
}
